const { Users } = require('../model')

async function main() {
  if (process.argv.length < 3) {
    console.log('provide more args')
    process.exit(1)
  }

  const command = process.argv[2]
  if (command === 'scan') {
    console.log((await Users.scan().all().exec()).toJSON())
  } else if (command === 'dump') {
    const users = await Users.scan().all().exec()
    console.log('name,address')
    users.forEach((element) => {
      console.log(`${element.name},${element.address}`)
    })
  } else if (command === 'getByName') {
    console.log(await Users.query('name').eq(process.argv[3]).exec())
  } else if (command === 'getByAddress') {
    console.log(await Users.query('address').eq(process.argv[3]).exec())
  } else if (command === 'getByShortAddress') {
    console.log(await Users.scan('address').beginsWith(process.argv[3]).exec())
  } else {
    console.error('unknown command')
    process.exit(1)
  }
}
main()
