const { Transaction } = require('@ethereumjs/tx')
const Common = require('@ethereumjs/common').default
const _ = require('lodash')

const BLACKLIST = []

const MAX_DISTINCT_TO = 2

const commonOpts = new Common({ chain: process.env.CHAIN_NAME || 'mainnet' })

function checkBlacklistTx(rawTx) {
  const tx = Transaction.fromRlpSerializedTx(rawTx, { common: commonOpts })

  return (tx.to && _.includes(BLACKLIST, tx.to.toString())) || _.includes(BLACKLIST, tx.getSenderAddress().toString())
}
function checkBlacklist(bundle) {
  for (let i = 0; i < bundle.length; i++) {
    const tx = bundle[i]
    if (checkBlacklistTx(tx)) {
      return true
    }
  }

  return false
}

function checkDistinctAddresses(bundle) {
  const fromAddresses = {}
  const toAddresses = {}
  bundle.forEach((rawTx) => {
    const tx = Transaction.fromRlpSerializedTx(rawTx, { common: commonOpts })
    toAddresses[tx.to && tx.to.toString()] = true
    fromAddresses[tx.getSenderAddress() && tx.getSenderAddress().toString()] = true
  })

  return Object.keys(toAddresses).length > MAX_DISTINCT_TO && Object.keys(fromAddresses).length > MAX_DISTINCT_TO
}

module.exports = { checkBlacklist, checkDistinctAddresses, MAX_DISTINCT_TO }
