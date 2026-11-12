ALTER TABLE campaigns ADD COLUMN send_mode text NOT NULL DEFAULT 'scheduled'
  CHECK (send_mode IN ('scheduled', 'now'));
