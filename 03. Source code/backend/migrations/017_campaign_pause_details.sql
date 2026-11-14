ALTER TABLE campaigns ADD COLUMN paused_at timestamptz;
ALTER TABLE campaigns ADD COLUMN pause_reason text CHECK (char_length(pause_reason) <= 250);
