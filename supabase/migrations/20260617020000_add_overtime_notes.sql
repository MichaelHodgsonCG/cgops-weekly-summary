/*
  Add overtime_notes to weekly_chef_summary to support the Guided Weekly
  Package's Overtime step (Section 1, Step 3), where chefs explain any
  overtime pulled from the Profit Center Report.
*/

ALTER TABLE weekly_chef_summary
  ADD COLUMN IF NOT EXISTS overtime_notes text DEFAULT '';
