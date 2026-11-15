ALTER TABLE campaign_assets DROP CONSTRAINT campaign_assets_kind_check;
ALTER TABLE campaign_assets ADD CONSTRAINT campaign_assets_kind_check CHECK (kind IN ('logo','pdf','image'));
