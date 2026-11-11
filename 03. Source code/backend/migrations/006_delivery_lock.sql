CREATE UNIQUE INDEX email_deliveries_one_inflight_per_contact ON email_deliveries(contact_id) WHERE state='sending';
