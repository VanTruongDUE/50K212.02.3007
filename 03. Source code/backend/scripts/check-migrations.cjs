const { Client } = require('pg');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');

const database = `v5si_check_${randomBytes(6).toString('hex')}`;
const options = {
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

async function main() {
  const admin = new Client({ ...options, database: 'postgres' });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${database}`);
    const result = spawnSync(process.execPath, ['scripts/migrate.cjs'], {
      cwd: require('node:path').join(__dirname, '..'),
      env: { ...process.env, POSTGRES_DB: database },
      encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Migration failed');
    const check = new Client({ ...options, database });
    await check.connect();
    try {
      const applied = await check.query('SELECT count(*)::int AS count FROM schema_migrations');
      const expected = require('node:fs').readdirSync(require('node:path').join(__dirname, '..', 'migrations')).filter((name) => name.endsWith('.sql')).length;
      if (applied.rows[0].count !== expected) throw new Error(`Expected ${expected} migrations; got ${applied.rows[0].count}`);
    } finally { await check.end(); }
    console.log('All migrations applied to a fresh temporary database.');
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin.end();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
