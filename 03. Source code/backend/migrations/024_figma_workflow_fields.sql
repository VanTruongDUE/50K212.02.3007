CREATE TABLE search_criteria_drafts (
  owner_id text PRIMARY KEY REFERENCES employees(id),
  criteria jsonb NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sender_accounts ADD COLUMN code text;
UPDATE sender_accounts SET code='TK-' || id WHERE code IS NULL;
ALTER TABLE sender_accounts ALTER COLUMN code SET NOT NULL;
ALTER TABLE sender_accounts ALTER COLUMN code SET DEFAULT ('TK-' || gen_random_uuid()::text);
CREATE UNIQUE INDEX sender_accounts_code_unique ON sender_accounts(lower(code));
ALTER TABLE sender_accounts ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE campaigns ADD COLUMN sender_name text;
ALTER TABLE campaigns ADD COLUMN needs_reconfirmation boolean NOT NULL DEFAULT false;
ALTER TABLE campaigns ADD COLUMN preview_draft_hash text;
ALTER TABLE campaigns ADD COLUMN filter_summary jsonb;
ALTER TABLE campaigns ADD COLUMN send_rate integer NOT NULL DEFAULT 50 CHECK (send_rate BETWEEN 1 AND 100);
ALTER TABLE campaigns ADD COLUMN window_start time NOT NULL DEFAULT '08:00';
ALTER TABLE campaigns ADD COLUMN window_end time NOT NULL DEFAULT '17:00';
ALTER TABLE campaigns ADD CONSTRAINT campaign_window_order CHECK (window_start < window_end);
ALTER TABLE followups ADD COLUMN worker_error text;
ALTER TABLE followups ADD COLUMN worker_error_stage text CHECK (worker_error_stage IN ('chain','result'));
