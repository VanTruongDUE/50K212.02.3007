CREATE TABLE campaign_assets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id bigint NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('logo','pdf')),
  file_name text NOT NULL,
  content_type text NOT NULL,
  content bytea NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 10000000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX campaign_assets_one_logo ON campaign_assets(campaign_id) WHERE kind='logo';
