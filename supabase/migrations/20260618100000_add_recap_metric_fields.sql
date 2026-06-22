/*
  Add recap metric fields to weekly_chef_summary to support the Guided Weekly
  Package's Sales & Execution Recap step (Section 4, Step 1), where the app
  computes WTD/PTD/YTD sales, food cost, and labour metrics used both for
  display and to feed the AI summary prompt.
*/

ALTER TABLE weekly_chef_summary
  ADD COLUMN IF NOT EXISTS recap_sales_ytd_actual numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recap_sales_ytd_budget numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recap_sales_wtd_actual numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recap_sales_wtd_budget numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recap_fc_wtd_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recap_fc_ptd_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recap_fc_ytd_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recap_fc_ytd_budget_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recap_fc_ytd_variance_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recap_labour_wtd_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recap_labour_ptd_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recap_labour_ytd_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recap_labour_ytd_budget_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recap_labour_ytd_variance_amount numeric DEFAULT 0;
