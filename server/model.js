const dynamoose = require('dynamoose')
const crypto = require('crypto')
const util = require('util')
const _ = require('lodash')

const pbkdf2 = util.promisify(crypto.pbkdf2)

const Users = dynamoose.model(
  'RelayUsers',
  new dynamoose.Schema({
    email: String,
    keyID: { type: String, index: { global: true } },
    hashedSecretKey: { type: String, index: { global: true } },
    salt: String
  })
)

function generateSalt() {
  return crypto.randomBytes(32).toString('base64')
}

function generateKeyID() {
  return _.trimEnd(crypto.randomBytes(32).toString('base64'), '=')
}

function generateSecretKey() {
  return _.trimEnd(crypto.randomBytes(64).toString('base64'), '=')
}

async function hashPass(pass, salt) {
  return (await pbkdf2(pass, salt, 1000, 64, 'sha512')).toString('hex')
}

module.exports = { Users, generateSalt, generateKeyID, generateSecretKey, hashPass }
