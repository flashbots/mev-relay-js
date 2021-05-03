const fetch = require('node-fetch')
const Sentry = require('@sentry/node')
const request = require('request')
const AWS = require('aws-sdk')
const postgres = require('postgres')

const { writeError } = require('./utils')
const { checkBlacklist, checkDistinctAddresses, getParsedTransactions, MAX_DISTINCT_TO } = require('./bundle')

class Handler {
  constructor(MINERS, SIMULATION_RPC, SQS_URL, PSQL_DSN, promClient) {
    this.MINERS = MINERS
    this.SIMULATION_RPC = SIMULATION_RPC
    this.sql = postgres(PSQL_DSN)

    this.bundleCounter = new promClient.Counter({
      name: 'bundles',
      help: '# of bundles received'
    })
    if (SQS_URL) {
      this.sqs = new AWS.SQS({ apiVersion: '2012-11-05' })
    }
    this.SQS_URL = SQS_URL
  }

  async handleSendBundle(req, res) {
    if (!req.body.params || !req.body.params[0]) {
      writeError(res, 400, 'missing params')
      return
    }
    this.bundleCounter.inc()
    const bundle = req.body.params[0]
    let txs = bundle
    if (!Array.isArray(txs)) {
      txs = bundle.txs
    }

    try {
      const parsedTransactions = getParsedTransactions(txs)
      if (checkBlacklist(parsedTransactions)) {
        console.error(`txs was interacting with blacklisted address: ${txs}`)
        writeError(res, 400, 'blacklisted tx')
        return
      } else if (checkDistinctAddresses(parsedTransactions)) {
        console.error(`bundle interacted with more than ${MAX_DISTINCT_TO} addresses`)
        writeError(res, 400, `bundle interacted with more than ${MAX_DISTINCT_TO} addresses`)
        return
      }
    } catch (error) {
      console.error(`error decoding bundle: ${error}`)
      writeError(res, 400, 'unable to decode txs')
      return
    }
    const blockParam = req.body.params[1] || bundle.blockNumber
    if (!blockParam) {
      writeError(res, 400, 'missing block param')
      return
    }
    if (blockParam.slice(0, 2) !== '0x' || !(parseInt(blockParam, 16) > 0)) {
      writeError(res, 400, 'block param must be a hex int')
      return
    }
    const minTimestamp = req.body.params[2] || bundle.minTimestamp
    if (minTimestamp && !(minTimestamp > 0)) {
      writeError(res, 400, 'minTimestamp must be an int')
      return
    }
    const maxTimestamp = req.body.params[3] || bundle.maxTimestamp
    if (maxTimestamp && !(maxTimestamp > 0)) {
      writeError(res, 400, 'maxTimestamp must be an int')
      return
    }

    const requests = []
    this.MINERS.forEach((minerUrl) => {
      try {
        requests.push(
          fetch(`${minerUrl}`, {
            method: 'post',
            body: JSON.stringify(req.body),
            headers: { 'Content-Type': 'application/json' }
          })
        )
      } catch (error) {
        Sentry.captureException(error)
        console.error('Error calling miner', minerUrl, error)
      }
    })

    if (this.SQS_URL) {
      const params = {
        DelaySeconds: 0,
        MessageAttributes: {},
        MessageBody: JSON.stringify(req.body),
        QueueUrl: this.SQS_URL
      }
      if (req.user.keyID) {
        params.MessageAttributes.KeyID = {
          DataType: 'String',
          StringValue: req.user.keyID
        }
      }
      if (req.user.address) {
        params.MessageAttributes.SignerAddress = {
          DataType: 'String',
          StringValue: req.user.address
        }
      }

      await this.sqs.sendMessage(params).promise()
    }
    res.setHeader('Content-Type', 'application/json')
    res.end(`{"jsonrpc":"2.0","id":${req.body.id},"result":null}`)
  }

  async handleCallBundle(req, res) {
    let bundle = req.body.params[0]
    if (!Array.isArray(bundle)) {
      bundle = bundle.txs
    }
    const parsedTransactions = getParsedTransactions(bundle)
    try {
      if (checkBlacklist(parsedTransactions)) {
        console.error(`bundle was interacting with blacklisted address: ${parsedTransactions}`)
        writeError(res, 400, 'blacklisted tx')
        return
      } else if (checkDistinctAddresses(parsedTransactions)) {
        console.error(`bundle interacted with more than ${MAX_DISTINCT_TO} addresses`)
        writeError(res, 400, `bundle interacted with more than ${MAX_DISTINCT_TO} addresses`)
        return
      }
    } catch (error) {
      console.error(`error decoding bundle: ${error}`)
      writeError(res, 400, 'unable to decode txs')
      return
    }

    req.body.params = [...req.body.params.slice(0, 3), process.env.COINBASE_ADDRESS, ...req.body.params.slice(3)]

    request
      .post({
        url: this.SIMULATION_RPC,
        body: JSON.stringify(req.body),
        headers: { 'Content-Type': 'application/json' }
      })
      .on('error', function (error) {
        Sentry.captureException(error)
        console.error('Error in proxying callBundle', error)
        res.writeHead(500)
        res.end('internal server error')
      })
      .pipe(res)
  }

  async handleUserStats(req, res) {
    if (req.user.keyID) {
      const stats = await this.sql`
      select
          *
      from
        stats_by_user_key_id
      where
          ${req.user.keyID} = user_key_id`

      if (stats.length === 0) {
        return res.json({ error: { message: "stats don't exist for this user", code: -32602 } })
      }
      res.json({ result: stats[0] })
    } else {
      const stats = await this.sql`
      select
          *
      from
        stats_by_signing_address
      where
          ${req.user.address} = signing_address`

      if (stats.length === 0) {
        return res.json({ error: { message: "stats don't exist for this user", code: -32602 } })
      }
      res.json({ result: stats[0] })
    }
  }
}

module.exports.Handler = Handler
