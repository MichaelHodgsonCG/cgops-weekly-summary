/*
  Add discount_review_notes to weekly_chef_summary to support the
  Guided Weekly Package's Discounts step (Section 2, Step 1), where chefs
  comment on the discount items pulled from the uploaded report.
*/

ALTER TABLE weekly_chef_summary
  ADD COLUMN IF NOT EXISTS discount_review_notes text DEFAULT '';
