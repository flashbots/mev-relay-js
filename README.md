# mev-relay

This repository contains a public relay for accepting transactions from searchers. It also contains an example reverse proxy for miners to run in front of their mev-geth nodes. This relay is meant only to protect participating miners from abuse via DoS attacks, but does otherwise no bundle filtering or censoring.

## Public Relay

[This is the relay entrypoint](server/main.js). The public flashbots relay is available at https://relay.flashbots.net. See https://github.com/flashbots/ethers-provider-flashbots-bundle for a library to help you call this.

The relay provides new JSON-RPC methods for interfacing with Flashbots. They are documented below:

### eth_sendBundle
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_sendBundle",
  "params": [
    signedTxs,
    blockNumber,
    minTimestamp,
    maxTimestamp
  ]
}
```

* **signedTxs**: Array[String], A list of signed transactions to execute in an atomic bundle
* **blockNumber**: String, a hex encoded block number for which this bundle is valid on
* **minTimestamp**: Number, the minimum timestamp for which this bundle is valid, in seconds since the unix epoch
* **maxTimestamp**: Number, the minimum timestamp for which this bundle is valid, in seconds since the unix epoch

Example:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_sendBundle",
  "params": [
    ["0x123abc...", "0x456def..."],
    "0xb63dcd",
    0,
    1615920932
  ]
}
```

### eth_callBundle
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_sendBundle",
  "params": [
    signedTxs,
    targetBlockNumber,
    stateBlockNumber,
    timestamp
  ]
}
```

* **signedTxs**: Array[String], A list of signed transactions to execute in an atomic bundle
* **targetBlockNumber**: String, a hex encoded block number for which this bundle is valid on
* **stateBlockNumber**: String, either a hex encoded number or a block tag for which state to base this simulation on. Can use "latest"
* **timestamp(Optional)**: Number, the timestamp to use for this bundle simulation, in seconds since the unix epoch

Example:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_callBundle",
  "params": [
    ["0x123abc...", "0x456def..."],
    "0xb63dcd",
    "latest",
    1615920932
  ]
}
```
### flashbots_getUserStats
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "flashbots_getUserStats",
  "params": [
      blockNumber
  ]
}
```

* **blockNumber**: String, a hex encoded recent block number, in order to prevent replay attacks. Must be within 20 blocks of the current chain tip.

Returns a quick summary of how this searcher is performing in the relay:
```json
{
  signing_address: '0x123...',
  blocks_won_total: 283,
  bundles_submitted_total: 8503,
  bundles_error_total: 0,
  avg_gas_price_gwei: 73.43275884220039,
  blocks_won_last_7d: 283,
  bundles_submitted_last_7d: 8503,
  bundles_error_7d: 0,
  avg_gas_price_gwei_last_7d: 73.43275884220039,
  blocks_won_last_1d: 83,
  bundles_submitted_last_1d: 757,
  bundles_error_1d: 0,
  avg_gas_price_gwei_last_1d: 227.44116622595683,
  blocks_won_last_1h: 0,
  bundles_submitted_last_1h: 38,
  bundles_error_1h: 0,
  avg_gas_price_gwei_last_1h: 103.30447379959334,
  blocks_won_last_5m: 0,
  bundles_submitted_last_5m: 0,
  bundles_error_5m: 0,
  avg_gas_price_gwei_last_5m: null
}
```

* **blocks_won**: This number represents how many blocks were won by this user, according to the relay. This is **not** how many ended up on chain, this is just what our relay thinks would've won.
* **avg_gas_price_gwei**: The adjusted gas price, averaged over all submissions by this user.

## Authentication

This relay requires that all payloads are signed with an ethereum wallet.

The signature is calculated by taking the EIP-191 hash of the json body encoded as UTF-8 bytes. Here's an example using ethers.js:
```js
wallet = ethers.Wallet.createRandom()
wallet.signMessage(ethers.utils.id(body))
```

Take this signature and append it to the ethereum address of the signer, separated by a colon, `:`. Then send it in the `X-Flashbots-Signature` HTTP header like so:
```
X-Flashbots-Signature: 0x95c622A2c597a8bdC26D371Dd3D57dA9D26052DF:0xc73d4790fed41954869625c159a4617e3374019839a8ad72de15e41371719d6873c780e00293fcdc100aa505f33dd8480e7b07551483c8c438fe8236972d26ca1c
```

This signer does not have to be related to the signer of your actual transactions. It is just used for authentication/rate limiting purposes, and is how `flashbots_getUserStats` determines the user.

## Miners

[A simple example](miner/proxy.js) of a reverse proxy that a miner can run to expose just the eth_sendBundle JSON-RPC method. You can install/run it like so:

```bash
# install nodejs on your system, e.g. `sudo apt install nodejs npm` on debian/ubuntu
sudo npm install -g yarn

git clone https://github.com/flashbots/mev-relay-js.git
cd mev-relay-js

yarn install
yarn run miner
```
