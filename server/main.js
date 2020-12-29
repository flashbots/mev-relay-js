// A simple server that proxies only specific methods to an Ethereum JSON-RPC
const express = require('express')
const bodyParser = require('body-parser')
const fetch = require('node-fetch')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const _ = require('lodash')
const Sentry = require('@sentry/node')
const promBundle = require('express-prom-bundle')
const { sumBundleGasLimit } = require('./bundle')

if (process.env.SENTRY_DSN) {
  console.log('initializing sentry')
  Sentry.init({
    dsn: process.env.SENTRY_DSN
  })
}

const ALLOWED_METHODS = ['eth_sendBundle']

function help() {
  console.log('node ./server/main.js minerUrlS [PORT]')
}

function validPort(port) {
  if (isNaN(port) || port < 0 || port > 65535) {
    return false
  }

  return true
}

if (_.includes(process.argv, '-h') || _.includes(process.argv, '--help')) {
  help()
  process.exit(0)
}

const MINERS = _.split(process.argv[2], ',')
if (MINERS.length === 0) {
  console.error('no valid miner urls provided')
  help()
  process.exit(1)
}

const PORT = parseInt(_.get(process.argv, '[3]', '18545'))

if (!validPort(PORT)) {
  console.error(`invalid port specified for PORT: ${PORT}`)
  process.exit(1)
}

const app = express()
const metricsRequestMiddleware = promBundle({
  includePath: true,
  includeMethod: true,
  autoregister: false, // Do not register /metrics
  promClient: {
    collectDefaultMetrics: {}
  }
})
const { promClient, metricsMiddleware } = metricsRequestMiddleware

// Metrics app to expose /metrics endpoint
const metricsApp = express()
metricsApp.use(metricsMiddleware)

app.use(metricsRequestMiddleware)
app.use(bodyParser.json())
app.use(morgan('combined'))
app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30 // limit each IP to 30 requests per windowMs
  })
)
const bundleCounter = new promClient.Counter({
  name: 'bundles',
  help: '# of bundles received'
})

const gasHist = new promClient.Histogram({
  name: 'gas_limit',
  help: 'Histogram of gas limit in bundles',
  buckets: [22000, 50000, 100000, 150000, 200000, 300000, 400000, 500000, 750000, 1000000, 1250000, 1500000, 2000000, 3000000]
})

app.use(async (req, res) => {
  try {
    if (!req.body) {
      res.writeHead(400)
      res.end('invalid json body')
      return
    }
    if (!req.body.method) {
      res.writeHead(400)
      res.end('missing method')
      return
    }
    if (!_.includes(ALLOWED_METHODS, req.body.method)) {
      res.writeHead(400)
      res.end(`invalid method, only ${ALLOWED_METHODS} supported, you provided: ${req.body.method}`)
      return
    }
    if (req.body.method === 'eth_sendBundle') {
      if (!req.body.params || !req.body.params[0]) {
        res.writeHead(400)
        res.end('missing params')
        return
      }
      bundleCounter.inc()
      const bundle = req.body.params[0]
      try {
        const gasSum = sumBundleGasLimit(bundle)
        gasHist.observe(gasSum)
      } catch (error) {
        console.error(`error decoding bundle: ${error}`)
        res.writeHead(400)
        res.end('unable to decode txs')
        return
      }
    }
    console.log(`request body: ${req.body}`)

    const requests = []
    MINERS.forEach((minerUrl) => {
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

    const responses = await Promise.all(requests)

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i]
      if (!response.ok) {
        const text = await response.text()
        console.error(`http error calling miner ${MINERS[i]} with status ${response.status} and text: ${text}`)
      }
    }

    res.setHeader('Content-Type', 'application/json')
    res.end(`{"jsonrpc":"2.0","id":${req.body.id},"result":null}`)
  } catch (error) {
    Sentry.captureException(error)
    console.error(`error in handler: ${error}`)
    try {
      res.writeHead(500)
      res.end('internal server error')
    } catch (error2) {
      Sentry.captureException(error2)
      console.error(`error in error response: ${error2}`)
    }
  }
})

app.listen(PORT, () => {
  metricsApp.listen(9090)

  console.log(`relay listening at ${PORT}`)
})
