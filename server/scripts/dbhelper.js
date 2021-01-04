const { Users, generateSalt, generateAccessKey, generateSecretKey, hashPass } = require('../model')

async function main() {
  if (process.argv.length < 3) {
    console.log('provide more args')
    process.exit(1)
  }

  const command = process.argv[2]
  if (command === 'create') {
    const salt = generateSalt()
    const secretKey = generateSecretKey()
    const user = new Users({
      email: process.argv[3],
      accessKey: generateAccessKey(),
      hashedSecretKey: await hashPass(secretKey, salt),
      salt: salt
    })
    console.log(await user.save())
    console.log('SECRET KEY:', secretKey)
  } else if (command === 'update') {
    console.log('TODO')
    // const user = (await Users.query('username').eq(process.argv[3]).exec())[0]
    // user.salt = generateSalt()
    // user.hashedSecretKey = await hashPass(process.argv[4], user.salt)
    // console.log(await user.save())
  } else if (command === 'scan') {
    console.log((await Users.scan().all().exec()).toJSON())
  } else if (command === 'getByEmail') {
    console.log(await Users.query('email').eq(process.argv[3]).exec())
  } else if (command === 'getByAccessKey') {
    console.log(await Users.query('accessKey').eq(process.argv[3]).exec())
  } else {
    console.error('unknown command')
    process.exit(1)
  }
}
main()
