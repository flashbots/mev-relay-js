const dynamoose = require('dynamoose')
const crypto = require('crypto')
const util = require('util')

const pbkdf2 = util.promisify(crypto.pbkdf2)

const Users = dynamoose.model(
  'RelayUsers',
  new dynamoose.Schema({
    email: String,
    accessKey: { type: String, index: { global: true } },
    hashedSecretKey: { type: String, index: { global: true } },
    salt: String
  })
)

function generateSalt() {
  return crypto.randomBytes(32).toString('base64')
}

function generateAccessKey() {
  return crypto.randomBytes(32).toString('base64').slice(0, -1)
}

function generateSecretKey() {
  return crypto.randomBytes(32).toString('base64').slice(0, -1)
}

async function hashPass(pass, salt) {
  return (await pbkdf2(pass, salt, 1000, 64, 'sha512')).toString('hex')
}

module.exports = { Users, generateSalt, generateAccessKey, generateSecretKey, hashPass }
