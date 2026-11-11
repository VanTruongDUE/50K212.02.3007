CREATE TABLE employees (
  id text PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL
);

CREATE UNIQUE INDEX employees_email_unique ON employees (lower(email));

CREATE TABLE login_accounts (
  employee_id text PRIMARY KEY REFERENCES employees(id),
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('employee', 'manager'))
);

CREATE TABLE auth_sessions (
  token_hash text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions (expires_at);
