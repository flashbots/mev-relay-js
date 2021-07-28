# mev-relay

This repository contains a public relay for accepting transactions from searchers. It also contains an example reverse proxy for miners to run in front of their mev-geth nodes. This relay is meant only to protect participating miners from abuse via DoS attacks, but does otherwise no bundle filtering or censoring.

This relay implementation was deprecated in the v2 relay upgrade in favor of a scalable alternative.

## Public Relay

[This is the relay entrypoint](server/main.js). The public flashbots relay is available at https://relay.flashbots.net. See https://github.com/flashbots/ethers-provider-flashbots-bundle for a library to help you call this.

The relay provides new JSON-RPC methods for interfacing with Flashbots. The api reference is available on the [flashbots documentation](https://docs.flashbots.net/flashbots-auction/searchers/advanced/rpc-endpoint/)

## Miners

See [https://github.com/flashbots/mev-proxy](https://github.com/flashbots/mev-proxy) for an example reverse proxy that this relay can connect to. Also, take a look at [https://github.com/flashbots/mev-geth](https://github.com/flashbots/mev-geth)
