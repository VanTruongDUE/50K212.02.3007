-- Each campaign reviews its own filtered recipients through the existing manager queue.
ALTER TABLE campaigns ADD COLUMN review_list_id bigint REFERENCES contact_lists(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX campaigns_review_list_unique ON campaigns(review_list_id) WHERE review_list_id IS NOT NULL;
