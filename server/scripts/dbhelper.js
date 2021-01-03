const { Users } = require('../model')

async function main() {
  if (process.argv.length < 3) {
    console.log('provide more args')
    process.exit(1)
  }

  const command = process.argv[2]
  if (command === 'create') {
    const user = new Users({ username: process.argv[3], apikey: process.argv[4], address: process.argv[5] })
    console.log(await user.save())
  } else if (command === 'update') {
    const user = (await Users.query('username').eq(process.argv[3]).exec())[0]
    user.apikey = process.argv[4]
    console.log(await user.save())
  } else if (command === 'scan') {
    console.log((await Users.scan().all().exec()).toJSON())
  } else if (command === 'getByUsername') {
    console.log(await Users.query('username').eq(process.argv[3]).exec())
  } else if (command === 'getByApiKey') {
    console.log(await Users.query('apikey').eq(process.argv[3]).exec())
  } else {
    console.error('unknown command')
    process.exit(1)
  }
}
main()
