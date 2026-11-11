CREATE TABLE filter_templates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id text NOT NULL REFERENCES employees(id),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  criteria jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX filter_templates_owner_name_unique ON filter_templates(owner_id, lower(name));
