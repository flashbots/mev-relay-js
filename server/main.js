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
const { Users, hashPass } = require('./model')

const MAX_GAS_BUNDLE = 3000000

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

function writeError(res, statusCode, errMsg) {
  res.status(statusCode)
  res.json({ error: { message: errMsg } })
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
app.use(morgan('combined'))
app.use(async (req, res, next) => {
  const auth = req.header('Authorization')
  if (!auth) {
    writeError(res, 403, 'missing Authorization header')
    return
  }
  next()
})
app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 15,
    keyGenerator: (req) => {
      return req.header('Authorization')
    }
  })
)
app.use(async (req, res, next) => {
  try {
    let auth = req.header('Authorization')
    if (_.startsWith(auth, 'Bearer ')) {
      auth = auth.slice(7)
    }

    auth = _.split(auth, ':')
    if (auth.length !== 2) {
      writeError(res, 403, 'invalid Authorization token')
      return
    }

    const username = auth[0]
    const key = auth[1]

    const users = await Users.query('keyID').eq(username).exec()
    const user = users[0]

    if (!user) {
      writeError(res, 403, 'invalid Authorization token')
      return
    }
    if ((await hashPass(key, user.salt)) !== user.hashedSecretKey) {
      writeError(res, 403, 'invalid Authorization token')
      return
    }
    next()
  } catch (error) {
    Sentry.captureException(error)
    console.error('error in auth middleware', error)
    try {
      writeError(res, 403, 'internal server error')
    } catch (error2) {
      Sentry.captureException(error2)
      console.error(`error in error response: ${error2}`)
    }
  }
})
// the 2nd rate limit will match all requests that get through the above
// middleware, so this becomes a global rate limit that only applies to valid
// requests
app.use(
  rateLimit({
    windowMs: 15 * 1000,
    max: 60,
    keyGenerator: () => {
      return ''
    }
  })
)
app.use(bodyParser.json())

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
      writeError(res, 400, 'invalid json body')
      return
    }
    if (!req.body.method) {
      writeError(res, 400, 'missing method')
      return
    }
    if (!_.includes(ALLOWED_METHODS, req.body.method)) {
      writeError(res, 400, `invalid method, only ${ALLOWED_METHODS} supported, you provided: ${req.body.method}`)
      return
    }
    if (req.body.method === 'eth_sendBundle') {
      if (!req.body.params || !req.body.params[0]) {
        writeError(res, 400, 'missing params')
        return
      }
      bundleCounter.inc()
      const bundle = req.body.params[0]
      try {
        const gasSum = sumBundleGasLimit(bundle)
        gasHist.observe(gasSum)

        if (gasSum > MAX_GAS_BUNDLE) {
          writeError(res, 400, 'gas limit of bundle exceeds', MAX_GAS_BUNDLE)
          return
        } else if (gasSum === 0) {
          writeError(res, 400, 'bundle spends no gas')
          return
        }
      } catch (error) {
        console.error(`error decoding bundle: ${error}`)
        writeError(res, 400, 'unable to decode txs')
        return
      }
    }
    console.log(`request body: ${JSON.stringify(req.body)}`)

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

    res.setHeader('Content-Type', 'application/json')
    res.end(`{"jsonrpc":"2.0","id":${req.body.id},"result":null}`)
  } catch (error) {
    Sentry.captureException(error)
    console.error(`error in handler: ${error}`)
    try {
      writeError(res, 500, 'internal server error')
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
