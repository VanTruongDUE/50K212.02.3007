ALTER TABLE sender_accounts ADD COLUMN inbound_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE imap_cursors (
  sender_account_id bigint PRIMARY KEY REFERENCES sender_accounts(id) ON DELETE CASCADE,
  uid_validity text NOT NULL,
  last_uid bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inbound_messages (
  sender_account_id bigint NOT NULL REFERENCES sender_accounts(id) ON DELETE CASCADE,
  uid_validity text NOT NULL,
  uid bigint NOT NULL,
  message_id text,
  response_id bigint REFERENCES responses(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(sender_account_id, uid_validity, uid)
);
