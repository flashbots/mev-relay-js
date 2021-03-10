// A simple server that proxies only specific methods to an Ethereum JSON-RPC
const express = require('express')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const _ = require('lodash')
const Sentry = require('@sentry/node')
const promBundle = require('express-prom-bundle')
const { Users, hashPass } = require('./model')
const { Handler } = require('./handlers')
const { writeError } = require('./utils')
const { verifyMessage, id } = require('ethers/lib/utils')
const { constants } = require('ethers')

if (process.env.SENTRY_DSN) {
  console.log('initializing sentry')
  Sentry.init({
    dsn: process.env.SENTRY_DSN
  })
}

const ALLOWED_METHODS = ['eth_sendBundle', 'eth_callBundle']

function help() {
  console.log('node ./server/main.js minerUrls simulationRpc sqsUrl [PORT]')
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

let MINERS = []
if (process.argv[2]) {
  MINERS = _.split(process.argv[2], ',')
}

const SIMULATION_RPC = process.argv[3]
if (!SIMULATION_RPC) {
  console.error('invalid simulation rpc provided')
  help()
  process.exit(1)
}

const SQS_URL = process.argv[4]
if (!SIMULATION_RPC) {
  console.error('invalid simulation rpc provided')
  help()
  process.exit(1)
}

const PORT = parseInt(_.get(process.argv, '[5]', '18545'))
const bundlesSeen = new Set()
const MAX_BUNDLE_MEMORY = 100000

if (!validPort(PORT)) {
  console.error(`invalid port specified for PORT: ${PORT}`)
  process.exit(1)
}

const app = express()
app.set('trust proxy', true)

app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // limit each IP to this many requests
    onLimitReached: (req) => {
      console.log(`rate limit reached for IP: ${req.ip}`)
    }
  })
)
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

const UNIQUE_USER_COUNT = {}
const bundleCounterPerUser = new promClient.Counter({
  name: 'relay_bundles_per_user',
  help: '# of bundles received per user',
  labelNames: ['username']
})

app.use(metricsRequestMiddleware)
app.use(morgan('combined'))
function rawBodySaver(req, _, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8')
  }
}
app.use(bodyParser.json({ verify: rawBodySaver }))
app.use(async (req, res, next) => {
  let auth = req.header('Authorization')
  let signature = req.header('X-Flashbots-Signature')
  if (!auth && !signature) {
    writeError(res, 403, 'missing Authorization or X-Flashbots-Signature header')
    return
  }
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

  req.user = {}
  if (signature) {
    signature = _.split(signature, ':')
    if (signature.length !== 2) {
      writeError(res, 403, 'invalid X-Flashbots-Signature header')
      return
    }

    const msg = id(req.rawBody)
    if (bundlesSeen.has(msg)) {
      writeError(res, 226, 'bundle seen recently')
      return
    }
    if (bundlesSeen.size > MAX_BUNDLE_MEMORY) {
      bundlesSeen.clear()
    }
    bundlesSeen.add(msg)

    try {
      const address = verifyMessage(msg, signature[1])
      if (address === constants.AddressZero) {
        writeError(res, 403, `invalid signature for ${signature[0]}`)
        return
      }
      if (address.toLowerCase() !== signature[0].toLowerCase()) {
        writeError(res, 403, `signer address does not equal expected, got ${address}, expected ${signature[0]}`)
        return
      }
      req.user.address = address
    } catch (err) {
      console.error(`error verifyMessage: ${err}`)
      writeError(res, 403, `error in signature check ${signature[0]}`)
      return
    }
  }

  if (auth) {
    if (_.startsWith(auth, 'Bearer ')) {
      auth = auth.slice(7)
    }

    auth = _.split(auth, ':')
    if (auth.length !== 2) {
      writeError(res, 403, 'invalid Authorization token')
      return
    }

    const keyID = auth[0]
    const secretKey = auth[1]

    const users = await Users.query('keyID').eq(keyID).exec()
    const user = users[0]

    if (!user) {
      writeError(res, 403, 'invalid Authorization token')
      return
    }
    if ((await hashPass(secretKey, user.salt)) !== user.hashedSecretKey) {
      writeError(res, 403, 'invalid Authorization token')
      return
    }

    req.user.keyID = keyID
  }

  const username = req.user.address || req.user.keyID.slice(0, 8)
  let count = UNIQUE_USER_COUNT[username]
  if (!count) {
    count = 0
  }
  UNIQUE_USER_COUNT[username] = count + 1

  bundleCounterPerUser.inc({ username })
  next()
})

const handler = new Handler(MINERS, SIMULATION_RPC, SQS_URL, promClient)

app.use(async (req, res) => {
  try {
    console.log(`request body: ${JSON.stringify(req.body)}`)

    if (req.body.method === 'eth_sendBundle') {
      await handler.handleSendBundle(req, res)
    } else if (req.body.method === 'eth_callBundle') {
      await handler.handleCallBundle(req, res)
    } else {
      const err = `unknown method: ${req.body.method}`
      Sentry.captureException(err)
      console.error(err)
      writeError(res, 400, err)
    }
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
process.on('unhandledRejection', (err) => {
  Sentry.captureException(err)
  console.error(`unhandled rejection: ${err} ${err.stack}`)
})

app.listen(PORT, () => {
  metricsApp.listen(9090)

  console.log(`relay listening at ${PORT}`)
})
