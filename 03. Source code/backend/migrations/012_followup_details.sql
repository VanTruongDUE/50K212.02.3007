ALTER TABLE followups
  ADD COLUMN channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'phone')),
  ADD COLUMN goal text NOT NULL DEFAULT '',
  ADD COLUMN reminder_minutes integer NOT NULL DEFAULT 60 CHECK (reminder_minutes >= 0 AND reminder_minutes <= 10080),
  ADD COLUMN wait_days integer NOT NULL DEFAULT 2 CHECK (wait_days BETWEEN 1 AND 30),
  ADD COLUMN max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 3),
  ADD COLUMN interval_days integer NOT NULL DEFAULT 2 CHECK (interval_days BETWEEN 1 AND 30);
UPDATE followups SET goal = coalesce(note, '') WHERE goal = '';
