/*
  Add fields to weekly_chef_summary to support the new guided wizard steps:
  - Team (Hiring Notes / TM MOTs of Note / Development Path Updates already exist;
    no new columns needed for staffing counts).
  - Facilities: splits the old combined R&M/Cleaning field into two distinct
    guide-fed fields.
  - Features: chef commentary on feature performance, captured in the guide.
  - Audit: chef commentary on the last audit score, captured in the guide.
*/

ALTER TABLE weekly_chef_summary
  ADD COLUMN IF NOT EXISTS rm_issues text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cleaning_focus text DEFAULT '',
  ADD COLUMN IF NOT EXISTS features_notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS audit_score_comment text DEFAULT '';
