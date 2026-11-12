ALTER TABLE followups
  ADD COLUMN outcome text CHECK (outcome IN ('awaiting', 'responded', 'no_response')),
  ADD COLUMN needs_next boolean NOT NULL DEFAULT false;
CREATE INDEX followups_awaiting_idx ON followups(completed_at) WHERE status='done' AND outcome='awaiting';
