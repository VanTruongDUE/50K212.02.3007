CREATE TABLE response_status_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  response_id bigint NOT NULL REFERENCES responses(id),
  actor_id text NOT NULL REFERENCES employees(id),
  from_status text NOT NULL,
  to_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX response_status_history_response_idx ON response_status_history(response_id, changed_at);
