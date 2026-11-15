CREATE TABLE contact_search_jobs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 owner_id text NOT NULL REFERENCES employees(id),
 request_key text NOT NULL,
 criteria jsonb NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed')),
 stage text NOT NULL DEFAULT 'queued',
 attempts integer NOT NULL DEFAULT 0,
 lease_token text,
 lease_until timestamptz,
 processed integer NOT NULL DEFAULT 0,
 received integer NOT NULL DEFAULT 0,
 invalid integer NOT NULL DEFAULT 0,
 duplicate integer NOT NULL DEFAULT 0,
 new_count integer NOT NULL DEFAULT 0,
 results jsonb NOT NULL DEFAULT '[]',
 warnings jsonb NOT NULL DEFAULT '[]',
 provider_ids jsonb NOT NULL DEFAULT '[]',
 list_id bigint REFERENCES contact_lists(id),
 error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 UNIQUE(owner_id,request_key)
);
CREATE INDEX search_owner_created_idx ON contact_search_jobs(owner_id,id DESC);
CREATE INDEX search_pending_idx ON contact_search_jobs(status,lease_until);
ALTER TABLE contacts ADD COLUMN search_provenance jsonb;
