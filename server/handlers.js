const fetch = require('node-fetch')
const Sentry = require('@sentry/node')
const request = require('request')
const AWS = require('aws-sdk')

const { writeError } = require('./utils')
const { checkBlacklist } = require('./bundle')

class Handler {
  constructor(MINERS, SIMULATION_RPC, SQS_URL, promClient) {
    this.MINERS = MINERS
    this.SIMULATION_RPC = SIMULATION_RPC

    this.bundleCounter = new promClient.Counter({
      name: 'bundles',
      help: '# of bundles received'
    })
    this.sqs = new AWS.SQS({ apiVersion: '2012-11-05' })
    this.SQS_URL = SQS_URL
  }

  async handleSendBundle(req, res) {
    if (!req.body.params || !req.body.params[0]) {
      writeError(res, 400, 'missing params')
      return
    }
    this.bundleCounter.inc()
    const bundle = req.body.params[0]
    try {
      if (checkBlacklist(bundle)) {
        console.error(`bundle was interacting with blacklisted address: ${bundle}`)
        writeError(res, 400, 'unable to decode txs')
        return
      }
    } catch (error) {
      console.error(`error decoding bundle: ${error}`)
      writeError(res, 400, 'unable to decode txs')
      return
    }
    if (!req.body.params[1]) {
      writeError(res, 400, 'missing block param')
      return
    }
    if (req.body.params[1].slice(0, 2) !== '0x' || !(parseInt(req.body.params[1], 16) > 0)) {
      writeError(res, 400, 'block param must be a hex int')
      return
    }
    if (req.body.params[2] && !(req.body.params[2] > 0)) {
      writeError(res, 400, 'timestamp must be an int')
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

    const params = {
      DelaySeconds: 0,
      MessageAttributes: {
        KeyID: {
          DataType: 'String',
          StringValue: req.user.keyID
        }
      },
      MessageBody: JSON.stringify(req.body),
      QueueUrl: this.SQS_URL
    }

    await this.sqs.sendMessage(params).promise()

    res.setHeader('Content-Type', 'application/json')
    res.end(`{"jsonrpc":"2.0","id":${req.body.id},"result":null}`)
  }

  async handleCallBundle(req, res) {
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
}

module.exports.Handler = Handler
