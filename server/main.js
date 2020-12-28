// A simple server that proxies only specific methods to an Ethereum JSON-RPC
const express = require('express')
const bodyParser = require('body-parser')
const fetch = require('node-fetch')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const _ = require('lodash')

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
app.use(bodyParser.json())
app.use(morgan('combined'))
app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30 // limit each IP to 30 requests per windowMs
  })
)

app.use(async (req, res) => {
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
})

app.listen(PORT, () => {
  console.log(`relay listening at ${PORT}`)
})
