const { ethers } = require('ethers')
const _ = require('lodash')

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

function checkBlacklistTx(rawTx) {
  const tx = ethers.utils.parseTransaction(rawTx)

  return (tx.to && _.includes(BLACKLIST, tx.to.toString())) || (tx.from && _.includes(BLACKLIST, tx.from.toString()))
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
    const tx = ethers.utils.parseTransaction(rawTx)
    toAddresses[tx.to && tx.to.toString()] = true
    fromAddresses[tx.from && tx.from.toString()] = true
  })

  return Object.keys(toAddresses).length > MAX_DISTINCT_TO && Object.keys(fromAddresses).length > MAX_DISTINCT_TO
}

module.exports = { checkBlacklist, checkDistinctAddresses, MAX_DISTINCT_TO }
