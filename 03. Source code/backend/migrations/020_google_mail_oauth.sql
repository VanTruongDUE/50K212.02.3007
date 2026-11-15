ALTER TABLE sender_accounts
  ADD COLUMN google_refresh_secret text,
  ADD COLUMN google_revision integer NOT NULL DEFAULT 0,
  ADD COLUMN google_status text CHECK (google_status IN ('connected','reconnect_required'));

CREATE TABLE google_mail_oauth_states (
  state_hash text PRIMARY KEY,
  session_hash text NOT NULL,
  sender_id bigint NOT NULL REFERENCES sender_accounts(id) ON DELETE CASCADE,
  email text NOT NULL,
  revision integer NOT NULL,
  verifier_secret text NOT NULL,
  expires_at timestamptz NOT NULL
);
