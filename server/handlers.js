const fetch = require('node-fetch')
const Sentry = require('@sentry/node')
const request = require('request')

class Handler {
  constructor(MINERS, SIMULATION_RPC) {
    this.MINERS = MINERS
    this.SIMULATION_RPC = SIMULATION_RPC
  }

  async handleSendBundle(req, res) {
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
      .on('error', function (e) {
        res.writeHead(500)
        res.end(`error in proxy: ${e}`)
      })
      .pipe(res)
  }
}

module.exports.Handler = Handler
