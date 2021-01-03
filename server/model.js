const dynamoose = require('dynamoose')
const crypto = require('crypto')
const util = require('util')

const pbkdf2 = util.promisify(crypto.pbkdf2)

const Users = dynamoose.model(
  'RelayUsers',
  new dynamoose.Schema({
    username: String,
    hashedApiKey: { type: String, index: { global: true } },
    salt: String,
    email: { type: String, index: { global: true } }
  })
)

function generateSalt() {
  return crypto.randomBytes(16).toString('hex')
}

async function hashPass(pass, salt) {
  return (await pbkdf2(pass, salt, 1000, 64, 'sha512')).toString('hex')
}

module.exports = { Users, generateSalt, hashPass }
