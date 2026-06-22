/*
  Add sales_action_plan to weekly_chef_summary to support the Guided Weekly
  Package's Sales & Execution Recap step (Section 4, Step 1), where chefs
  write a sales action plan after reviewing WTD/PTD/YTD sales, discounts,
  and line times.
*/

ALTER TABLE weekly_chef_summary
  ADD COLUMN IF NOT EXISTS sales_action_plan text DEFAULT '';
