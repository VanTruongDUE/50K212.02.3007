ALTER TABLE inbound_messages
  ADD COLUMN sender_email text,
  ADD COLUMN subject text,
  ADD COLUMN content text,
  ADD COLUMN ignored_at timestamptz;
CREATE INDEX inbound_messages_unmatched_idx ON inbound_messages(received_at DESC) WHERE response_id IS NULL AND ignored_at IS NULL;
