/*
  Add speed_of_service_notes to weekly_chef_summary to support the
  Guided Weekly Package's Speed of Service step (Section 3, Step 1), where
  chefs comment on bump-time performance pulled from the uploaded report.
*/

ALTER TABLE weekly_chef_summary
  ADD COLUMN IF NOT EXISTS speed_of_service_notes text DEFAULT '';
