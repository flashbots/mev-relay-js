const { TransactionFactory } = require('@ethereumjs/tx')
const _ = require('lodash')
const Common = require('@ethereumjs/common').default
const { arrayify, keccak256 } = require('ethers/lib/utils')

const commonOpts = new Common({ chain: process.env.CHAIN_NAME || 'mainnet' })

const BLACKLIST = [
  // OFAC banned addresses
  '0x8576acc5c05d6ce88f4e49bf65bdf0c62f91353c',
  '0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b',
  '0x901bb9583b24d97e995513c6778dc6888ab6870e',
  '0xa7e5d5a720f06526557c513402f2e6b5fa20b00', // this is an invalid address, but is what's listed in the OFAC ban list
  '0xa7e5d5a720f06526557c513402f2e6b5fa20b008', // the actual valid address
  '0x7f367cc41522ce07553e823bf3be79a889debe1b'
]

const MAX_DISTINCT_TO = 2

function checkBlacklistTx(tx) {
  return (tx.to && _.includes(BLACKLIST, tx.to.toString())) || (tx.from && _.includes(BLACKLIST, tx.from.toString()))
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

function checkDistinctAddresses(txs) {
  const fromAddresses = {}
  const toAddresses = {}
  txs.forEach((tx) => {
    toAddresses[tx.to && tx.to.toString()] = true
    fromAddresses[tx.from && tx.from.toString()] = true
  })

  return Object.keys(toAddresses).length > MAX_DISTINCT_TO && Object.keys(fromAddresses).length > MAX_DISTINCT_TO
}

function getParsedTransactions(rawTxs) {
  const parsedTransactions = []
  rawTxs.forEach((rawTx) => {
    parsedTransactions.push(
      TransactionFactory.fromSerializedData(arrayify(rawTx), { common: commonOpts })
    )
  })
  return parsedTransactions
}

function generateBundleHash(txs) {
  let hashes = '0x'
  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i]

    hashes += tx.hash.slice(2)
  }

  return keccak256(hashes)
}
module.exports = { checkBlacklist, checkDistinctAddresses, getParsedTransactions, MAX_DISTINCT_TO, generateBundleHash }
