/*
  Add fields to weekly_chef_summary to support:
  - Window Time, replacing QSR Weekend Lunch Time in Other Metrics, populated
    live from the Guided Weekly Package's Speed of Service step
    (Expo bump time minus Pivot bump time).
  - Final Food Cost Report chef comments (Section 6 of the guided package).
*/

ALTER TABLE weekly_chef_summary
  ADD COLUMN IF NOT EXISTS window_time text DEFAULT '',
  ADD COLUMN IF NOT EXISTS final_food_cost_comments text DEFAULT '';
