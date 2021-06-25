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
  "params": [{ txs, blockNumber, minTimestamp, maxTimestamp, revertingTxHashes }]
}
```

- **txs**: Array[String], A list of signed transactions to execute in an atomic bundle
- **blockNumber**: String, a hex encoded block number for which this bundle is valid on
- **minTimestamp(Optional)**: Number, the minimum timestamp for which this bundle is valid, in seconds since the unix epoch
- **maxTimestamp(Optional)**: Number, the minimum timestamp for which this bundle is valid, in seconds since the unix epoch
- **revertingTxHashes(Optional)**: Array[String], list of tx hashes within the bundle that are allowed to revert

Example:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_sendBundle",
  "params": [{ "txs": ["0x123abc...", "0x456def..."], "blockNumber": "0xb63dcd", "minTimestamp": 0, "maxTimestamp": 1615920932 }]
}
```

### eth_callBundle

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_callBundle",
  "params": [{ txs, blockNumber, stateBlockNumber, timestamp }]
}
```

- **txs**: Array[String], A list of signed transactions to execute in an atomic bundle
- **blockNumber**: String, a hex encoded block number for which this bundle is valid on
- **stateBlockNumber**: String, either a hex encoded number or a block tag for which state to base this simulation on. Can use "latest"
- **timestamp(Optional)**: Number, the timestamp to use for this bundle simulation, in seconds since the unix epoch

Example:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_callBundle",
  "params": [{ "txs": ["0x123abc...", "0x456def..."], "blockNumber": "0xb63dcd", "stateBlockNumber": "latest", "timestamp": 1615920932 }]
}
```

### flashbots_getUserStats

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "flashbots_getUserStats",
  "params": [blockNumber]
}
```

- **blockNumber**: String, a hex encoded recent block number, in order to prevent replay attacks. Must be within 20 blocks of the current chain tip.

Returns a quick summary of how this searcher is performing in the relay. Currently it is updated once every hour.

Example response:

```json
{
  "is_high_priority": true,
  "all_time_miner_payments": "1280749594841588639",
  "all_time_gas_simulated": "30049470846",
  "last_7d_miner_payments": "1280749594841588639",
  "last_7d_gas_simulated": "30049470846",
  "last_1d_miner_payments": "142305510537954293",
  "last_1d_gas_simulated": "2731770076"
}
```

- **is_high_priority**: boolean representing if this searcher has a high enough reputation to be in the high priority queue
- **all_time_miner_payments**: The total amount paid to miners over all time
- **all_time_gas_simulated**: The total amount of gas simulated across all bundles submitted to the relay. This is the actual gas used in simulations, not gas limit

## Authentication

This relay requires that all payloads are signed with an ethereum wallet.

The signature is calculated by taking the EIP-191 hash of the json body encoded as UTF-8 bytes. Here's an example using ethers.js:

```js
body = '{"id": 1234, "method", "eth_sendBundle", "params": [["0x123..."], "0xB84969"]}'
wallet = ethers.Wallet.createRandom()
wallet.signMessage(ethers.utils.id(body))
```

or in web3py:

```py
from web3 import Web3
from eth_account import Account, messages

body = '{"id": 1234, "method", "eth_sendBundle", "params": [["0x123..."], "0xB84969"]}'
message = messages.encode_defunct(text=Web3.keccak(text=body).hex())
signed_message = Account.sign_message(message, private_key=private_key_hex)
```

or in go:

```go
hashedBody := crypto.Keccak256Hash([]byte(body)).Hex()
sig, err := crypto.Sign(crypto.Keccak256([]byte("\x19Ethereum Signed Message:\n"+strconv.Itoa(len(hashedBody))+hashedBody)), pk)
signature := addr.Hex() + ":" + hexutil.Encode(sig)
```

Take this signature and append it to the ethereum address of the signer, separated by a colon, `:`. Then send it in the `X-Flashbots-Signature` HTTP header like so:

```
X-Flashbots-Signature: 0x95c622A2c597a8bdC26D371Dd3D57dA9D26052DF:0xc73d4790fed41954869625c159a4617e3374019839a8ad72de15e41371719d6873c780e00293fcdc100aa505f33dd8480e7b07551483c8c438fe8236972d26ca1c
```

This signer does not have to be related to the signer of your actual transactions. It is just used for authentication/rate limiting purposes, and is how `flashbots_getUserStats` determines the user.

## Miners

See [https://github.com/flashbots/mev-proxy](https://github.com/flashbots/mev-proxy) for an example reverse proxy that this relay can connect to. Also, take a look at [https://github.com/flashbots/mev-geth](https://github.com/flashbots/mev-geth)
