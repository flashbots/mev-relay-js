const dynamoose = require('dynamoose')

const Users = dynamoose.model(
  'RelayUsers',
  new dynamoose.Schema({ username: String, apikey: { type: String, index: { global: true } }, address: String })
)

module.exports = { Users }
