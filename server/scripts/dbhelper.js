const { Users, generateSalt, generateKeyID, generateSecretKey, hashPass } = require('../model')

async function main() {
  if (process.argv.length < 3) {
    console.log('provide more args')
    process.exit(1)
  }

  const command = process.argv[2]
  if (command === 'create') {
    const salt = generateSalt()
    const secretKey = generateSecretKey()
    const keyID = generateKeyID()
    const user = new Users({
      email: process.argv[3],
      keyID,
      hashedSecretKey: await hashPass(secretKey, salt),
      salt: salt
    })
    await user.save()
    console.log(`FLASHBOTS_KEY_ID=${keyID}`)
    console.log(`FLASHBOTS_SECRET=${secretKey}`)
  } else if (command === 'scan') {
    console.log((await Users.scan().all().exec()).toJSON())
  } else if (command === 'dump') {
    const users = await Users.scan().all().exec()
    console.log('email,shortKey')
    users.forEach((element) => {
      console.log(`${element.email},${element.keyID.slice(0, 8)}`)
    })
  } else if (command === 'getByEmail') {
    console.log(await Users.query('email').eq(process.argv[3]).exec())
  } else if (command === 'getByKeyID') {
    console.log(await Users.query('keyID').eq(process.argv[3]).exec())
  } else if (command === 'getByShortKeyID') {
    console.log(await Users.scan('keyID').beginsWith(process.argv[3]).exec())
  } else {
    console.error('unknown command')
    process.exit(1)
  }
}
main()
