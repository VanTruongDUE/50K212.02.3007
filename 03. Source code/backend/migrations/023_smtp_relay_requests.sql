CREATE TABLE smtp_relay_requests (
  id uuid PRIMARY KEY,
  account_email text NOT NULL,
  action text NOT NULL CHECK (action IN ('verify', 'send')),
  mail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX smtp_relay_requests_created_idx ON smtp_relay_requests(created_at);
