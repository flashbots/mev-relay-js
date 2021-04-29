const postgres = require('postgres')
const { v4: uuidv4 } = require('uuid');

async function main() {
  const numberOfKeysToGenerate = 20
  for(i=0;i<numberOfKeysToGenerate;i++){
    const randomUniqueKey = uuidv4();
    await sql`
    INSERT INTO miner_keys(key)
    VALUES
    (${randomUniqueKey})`;
  }
  process.exit(0)
}

async function isValidKey(key) {
  const sql = postgres('postgres://postgres:postgres@localhost:5432/')
  const result = await sql`SELECT EXISTS(SELECT 1 FROM miner_keys WHERE key = ${key});`
  return (result[0].exists)
}

//main()
