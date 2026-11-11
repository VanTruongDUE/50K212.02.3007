CREATE TABLE email_suppressions (
  email text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('unsubscribe','bounce')),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO email_suppressions(email,reason)
SELECT lower(email), CASE WHEN unsubscribed_at IS NOT NULL THEN 'unsubscribe' ELSE 'bounce' END
FROM contacts WHERE unsubscribed_at IS NOT NULL OR bounced_at IS NOT NULL;
