CREATE TABLE response_email_deliveries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  response_id bigint NOT NULL REFERENCES responses(id),
  sender_account_id bigint NOT NULL REFERENCES sender_accounts(id),
  actor_id text NOT NULL REFERENCES employees(id),
  subject text NOT NULL,
  content text NOT NULL,
  state text NOT NULL CHECK (state IN ('sending', 'sent', 'failed')),
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE UNIQUE INDEX response_email_one_sending ON response_email_deliveries(response_id) WHERE state = 'sending';
CREATE INDEX response_email_sender_usage ON response_email_deliveries(sender_account_id, created_at DESC) WHERE state IN ('sending', 'sent');
