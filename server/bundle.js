const { ethers } = require('ethers')
const _ = require('lodash')
const { keccak256 } = require('ethers/lib/utils')

const BLACKLIST = [
  // OFAC banned addresses
  '0x8576acc5c05d6ce88f4e49bf65bdf0c62f91353c',
  '0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b',
  '0x901bb9583b24d97e995513c6778dc6888ab6870e',
  '0xa7e5d5a720f06526557c513402f2e6b5fa20b00', // this is an invalid address, but is what's listed in the OFAC ban list
  '0xa7e5d5a720f06526557c513402f2e6b5fa20b008', // the actual valid address
  '0x7f367cc41522ce07553e823bf3be79a889debe1b',
  // below added 20210810
  '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a',
  '0x7Db418b5D567A4e0E8c59Ad71BE1FcE48f3E6107',
  '0x72a5843cc08275C8171E582972Aa4fDa8C397B2A',
  '0x7F19720A857F834887FC9A7bC0a0fBe7Fc7f8102',
  '0x9f4cda013e354b8fc285bf4b9a60460cee7f7ea9'
]

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
