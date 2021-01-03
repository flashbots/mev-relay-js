const { Users, generateSalt, hashPass } = require('../model')

async function main() {
  if (process.argv.length < 3) {
    console.log('provide more args')
    process.exit(1)
  }

  const command = process.argv[2]
  if (command === 'create') {
    const salt = generateSalt()
    const user = new Users({
      username: process.argv[3],
      hashedApiKey: await hashPass(process.argv[4], salt),
      email: process.argv[5],
      salt: salt
    })
    console.log(await user.save())
  } else if (command === 'update') {
    const user = (await Users.query('username').eq(process.argv[3]).exec())[0]
    user.salt = generateSalt()
    user.hashedApiKey = await hashPass(process.argv[4], user.salt)
    console.log(await user.save())
  } else if (command === 'scan') {
    console.log((await Users.scan().all().exec()).toJSON())
  } else if (command === 'getByUsername') {
    console.log(await Users.get(process.argv[3]))
  } else if (command === 'getByEmail') {
    console.log(await Users.query('email').eq(process.argv[3]).exec())
  } else {
    console.error('unknown command')
    process.exit(1)
  }
}
main()
