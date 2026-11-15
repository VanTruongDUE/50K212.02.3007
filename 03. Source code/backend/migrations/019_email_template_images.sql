CREATE TABLE email_template_images (
  template_id bigint NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  source_asset_id bigint NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('image/png','image/jpeg')),
  content bytea NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 2000000),
  PRIMARY KEY (template_id, source_asset_id)
);
