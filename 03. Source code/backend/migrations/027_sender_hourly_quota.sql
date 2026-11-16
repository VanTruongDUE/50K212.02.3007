ALTER TABLE sender_accounts ADD COLUMN quota_hourly integer;
UPDATE sender_accounts SET quota_hourly=LEAST(quota_3_days,50);
ALTER TABLE sender_accounts ALTER COLUMN quota_hourly SET NOT NULL;
ALTER TABLE sender_accounts ALTER COLUMN quota_hourly SET DEFAULT 1;
ALTER TABLE sender_accounts ADD CONSTRAINT sender_hourly_quota_valid CHECK(quota_hourly>0 AND quota_hourly<=quota_3_days);
