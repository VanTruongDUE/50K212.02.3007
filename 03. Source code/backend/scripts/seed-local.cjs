const { Client } = require('pg');
const { hashPassword } = require('../dist/auth/password');

const accounts = [
  [
    'NV001',
    'Minh Anh',
    'minhanh@example.com',
    'employee',
    process.env.DEMO_EMPLOYEE_PASSWORD,
  ],
  [
    'TP001',
    'Trưởng phòng Marketing',
    'truongphong@example.com',
    'manager',
    process.env.DEMO_MANAGER_PASSWORD,
  ],
];
if (accounts.some((account) => !account[4]))
  throw new Error(
    'Set both DEMO_EMPLOYEE_PASSWORD and DEMO_MANAGER_PASSWORD in .env',
  );

const client = new Client({
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  connectionTimeoutMillis: 3000,
});

async function seed() {
  await client.connect();
  await client.query('BEGIN');
  try {
    for (const [id, name, email, role, password] of accounts) {
      await client.query(
        'INSERT INTO employees (id, full_name, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [id, name, email],
      );
      const hash = await hashPassword(password);
      await client.query(
        'INSERT INTO login_accounts (employee_id, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (employee_id) DO UPDATE SET password_hash=EXCLUDED.password_hash, role=EXCLUDED.role',
        [id, hash, role],
      );
    }
    await client.query('COMMIT');
    console.log('Local employee and manager accounts are ready');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

seed()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
