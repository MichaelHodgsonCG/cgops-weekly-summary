/*
  Add a field to weekly_chef_summary to support the Guided Weekly Package's
  Final Food Cost Report step (Section 6), where chefs upload the Usage
  Summary - Group Totals report and the system recomputes usage per food
  category using GL purchase totals (Opening + GL Purchases - Closing -
  Waste) and compares it to the report's own Actual Usage figure.

  Stored as a JSON-encoded text blob since the category list/values are
  derived from the uploaded report each week.
*/

ALTER TABLE weekly_chef_summary
  ADD COLUMN IF NOT EXISTS final_food_cost_items text DEFAULT '[]';
