# mev-relay

This repository contains a public relay for accepting transactions from searchers. It also contains an example reverse proxy for miners to run in front of their mev-geth nodes.

## Public Relay

This is the relay entrypoint. You can run locally with `yarn run start`. See https://github.com/flashbots/ethers-provider-flashbots-bundle for how you should call this.

## Miners

A simple example of a reverse proxy that a miner can run to expose just the eth_sendBundle JSON-RPC method. You can install/run it like so:

```bash
# install nodejs on your system, e.g. `sudo apt install nodejs` on debian/ubuntu
sudo npm install -g yarn

git clone https://github.com/flashbots/mev-relay-js.git
cd mev-relay-js

yarn install
yarn run miner
```
