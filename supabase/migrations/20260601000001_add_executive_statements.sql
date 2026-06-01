ALTER TABLE weekly_executive_reports
  ADD COLUMN IF NOT EXISTS leadership_notes text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS opening_statement text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS closing_statement text DEFAULT ''::text;
