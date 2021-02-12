const { Transaction } = require('@ethereumjs/tx')
const _ = require('lodash')

const BLACKLIST = [
  // OFAC banned addresses
  '0x8576acc5c05d6ce88f4e49bf65bdf0c62f91353c',
  '0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b',
  '0x901bb9583b24d97e995513c6778dc6888ab6870e',
  '0xa7e5d5a720f06526557c513402f2e6b5fa20b00',
  '0x7f367cc41522ce07553e823bf3be79a889debe1b'
]

function checkBlacklistTx(rawTx) {
  const tx = Transaction.fromRlpSerializedTx(rawTx)

  return _.includes(BLACKLIST, tx.to.toString()) || _.includes(BLACKLIST, tx.getSenderAddress().toString())
}
function checkBlacklist(bundle) {
  bundle.forEach((tx) => {
    if (checkBlacklistTx(tx)) {
      return true
    }
  })

  return false
}

module.exports = { checkBlacklist }
