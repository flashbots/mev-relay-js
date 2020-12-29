const { decode } = require('@ethersproject/rlp')
const ethers = require('ethers')

function decodeTxGasLimit(rawTx) {
  const decodedTx = decode(rawTx)

  return ethers.BigNumber.from(decodedTx[2])
}
function sumBundleGasLimit(bundle) {
  let sum = ethers.BigNumber.from(0)
  bundle.forEach((tx) => {
    sum = sum.add(decodeTxGasLimit(tx))
  })

  return sum.toNumber()
}

module.exports = { sumBundleGasLimit }
