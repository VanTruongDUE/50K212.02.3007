ALTER TABLE contacts ADD COLUMN unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;

CREATE TABLE sender_accounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  email text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'blocked')),
  quota_3_days integer NOT NULL DEFAULT 100 CHECK (quota_3_days > 0),
  smtp_host text,
  smtp_port integer CHECK (smtp_port BETWEEN 1 AND 65535),
  smtp_user text,
  smtp_secret text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE email_templates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  subject text NOT NULL CHECK (length(trim(subject)) BETWEEN 1 AND 150),
  body text NOT NULL CHECK (length(trim(body)) > 0),
  owner_id text NOT NULL REFERENCES employees(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE campaigns (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  description text,
  owner_id text NOT NULL REFERENCES employees(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'rejected', 'approved', 'scheduled', 'sending', 'paused', 'completed')),
  manager_comment text,
  reviewed_by text REFERENCES employees(id),
  reviewed_at timestamptz,
  subject text,
  body text,
  previewed_at timestamptz,
  sender_account_id bigint REFERENCES sender_accounts(id),
  scheduled_at timestamptz,
  sent_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX campaigns_active_name_unique ON campaigns (lower(name)) WHERE status NOT IN ('completed');
CREATE INDEX campaigns_owner_idx ON campaigns(owner_id, created_at DESC);

CREATE TABLE campaign_lists (
  campaign_id bigint NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  list_id bigint NOT NULL REFERENCES contact_lists(id),
  PRIMARY KEY (campaign_id, list_id)
);

CREATE TABLE campaign_recipients (
  campaign_id bigint NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id bigint NOT NULL REFERENCES contacts(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  sent_at timestamptz,
  error text,
  PRIMARY KEY (campaign_id, contact_id)
);
CREATE INDEX campaign_recipients_contact_sent_idx ON campaign_recipients(contact_id, sent_at DESC) WHERE status = 'sent';

CREATE TABLE email_deliveries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id bigint NOT NULL REFERENCES campaigns(id),
  contact_id bigint NOT NULL REFERENCES contacts(id),
  sender_account_id bigint NOT NULL REFERENCES sender_accounts(id),
  state text NOT NULL CHECK (state IN ('sending', 'sent', 'failed')),
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX email_deliveries_account_sent_idx ON email_deliveries(sender_account_id, sent_at DESC) WHERE state = 'sent';
CREATE UNIQUE INDEX email_deliveries_inflight_unique ON email_deliveries(campaign_id, contact_id) WHERE state = 'sending';

CREATE TABLE responses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id bigint REFERENCES campaigns(id),
  contact_id bigint REFERENCES contacts(id),
  customer_name text NOT NULL,
  email text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('interested', 'not_interested', 'need_info', 'out_of_office', 'bounce', 'unsubscribe', 'spam', 'other')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processing', 'replied', 'closed')),
  assignee_id text NOT NULL REFERENCES employees(id),
  content text NOT NULL,
  hidden_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX responses_assignee_idx ON responses(assignee_id, received_at DESC) WHERE hidden_at IS NULL;

CREATE TABLE response_interactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  response_id bigint NOT NULL REFERENCES responses(id),
  actor_id text NOT NULL REFERENCES employees(id),
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'note')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE followups (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  response_id bigint NOT NULL REFERENCES responses(id),
  assignee_id text NOT NULL REFERENCES employees(id),
  due_at timestamptz NOT NULL,
  attempt integer NOT NULL CHECK (attempt BETWEEN 1 AND 3),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'cancelled')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE UNIQUE INDEX followups_one_pending ON followups(response_id) WHERE status = 'pending';
