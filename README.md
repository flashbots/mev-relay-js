# mev-relay

## server/main.js

This is the relay entrypoint, and is hosted at https://relay.flashbots.net:443. You can run locally with `yarn run start`

## miner/proxy.js

A simple example of a reverse proxy that a miner can run to expose just the eth_sendBundle JSON-RPC method
