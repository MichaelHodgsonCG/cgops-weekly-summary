/*
  Add labour_review_action_plan to weekly_chef_summary to support the
  Guided Weekly Package's Sales and Labour Review step (Section 1, Step 4),
  where chefs review WTD/PTD/YTD labour performance and write an action plan.
*/

ALTER TABLE weekly_chef_summary
  ADD COLUMN IF NOT EXISTS labour_review_action_plan text DEFAULT '';
