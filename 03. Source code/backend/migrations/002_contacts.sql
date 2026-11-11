CREATE TABLE contact_lists (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  owner_id text NOT NULL REFERENCES employees(id),
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  employee_review text NOT NULL DEFAULT 'pending' CHECK (employee_review IN ('pending', 'passed', 'failed')),
  confirmed_at timestamptz,
  manager_review text NOT NULL DEFAULT 'pending' CHECK (manager_review IN ('pending', 'approved', 'rejected')),
  manager_comment text,
  reviewed_by text REFERENCES employees(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_lists_owner_idx ON contact_lists(owner_id, created_at DESC);

CREATE TABLE contacts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  job_title text,
  company text,
  location text,
  source_url text,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX contacts_email_unique ON contacts(lower(email));

CREATE TABLE contact_list_items (
  list_id bigint NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  contact_id bigint NOT NULL REFERENCES contacts(id),
  PRIMARY KEY (list_id, contact_id)
);
