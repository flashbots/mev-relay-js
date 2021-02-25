const dynamoose = require('dynamoose')

const Users = dynamoose.model(
  'RelayUsersV2',
  new dynamoose.Schema({
    address: { type: String, index: { global: true } },
    name: { type: String, index: { global: true } }
  })
)

module.exports = { Users }
