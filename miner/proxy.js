// A simple server that proxies only specific methods to an Ethereum JSON-RPC
const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')

const app = express()

app.use(bodyParser.json())

app.use(function (req, res) {
    if (!req.body) {
        res.writeHead(400)
        res.end("invalid json body")
        return
    }
    if (!req.body.method) {
        res.writeHead(400)
        res.end("missing method")
        return
    }
    if (req.body.method !== "eth_sendBundle") {
        res.writeHead(400)
        res.end("invalid method, only eth_sendBundle supported")
        return
    }

    request.post({
        url: "http://localhost:8545",
        body: JSON.stringify(req.body),
        headers: { 'Content-Type': 'application/json' }
    }).on('error', function (e) {
        res.writeHead(500)
        res.end(`error in proxy: ${e}`);
    }).pipe(res);
})

const PORT = 18545
app.listen(PORT, () => {
    console.log(`Server listening at ${PORT}`)
})