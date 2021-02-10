const fetch = require('node-fetch')
const Sentry = require('@sentry/node')
const request = require('request')

module.exports.handleSendBundle = async (req, res, MINERS) => {
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
}

module.exports.handleCallBundle = async (req, res, SIMULATION_RPC) => {
  request
    .post({
      url: SIMULATION_RPC,
      body: JSON.stringify(req.body),
      headers: { 'Content-Type': 'application/json' }
    })
    .on('error', function (e) {
      res.writeHead(500)
      res.end(`error in proxy: ${e}`)
    })
    .pipe(res)
}
