const { ethers } = require('ethers')
const _ = require('lodash')
const { keccak256 } = require('ethers/lib/utils')

const BLACKLIST = []

function checkBlacklistTx(tx) {
  return (
    (tx.to && _.includes(BLACKLIST, tx.to.toString().toLowerCase())) || (tx.from && _.includes(BLACKLIST, tx.from.toString().toLowerCase()))
  )
}

function checkBlacklist(txs) {
  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i]
    if (checkBlacklistTx(tx)) {
      return true
    }
  }

  return false
}

function getParsedTransactions(rawTxs) {
  return rawTxs.map((rawTx) => {
    return ethers.utils.parseTransaction(rawTx)
  })
}

function generateBundleHash(txs) {
  let hashes = '0x'
  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i]

    hashes += tx.hash.slice(2)
  }

  return keccak256(hashes)
}
module.exports = { checkBlacklist, getParsedTransactions, generateBundleHash }
