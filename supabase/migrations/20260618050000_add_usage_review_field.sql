/*
  Add a field to weekly_chef_summary to support the Guided Weekly Package's
  Over/Under Usage Review step (Section 5), where chefs upload the
  reporting week and trailing 4-week Usage Summary Top 25/Bottom 10 reports
  and confirm/comment on the top 10 under-used and bottom 5 over-used items.

  Stored as a JSON-encoded text blob since the flagged item list is dynamic
  (item names and counts vary week to week).
*/

ALTER TABLE weekly_chef_summary
  ADD COLUMN IF NOT EXISTS usage_review_items text DEFAULT '[]';
