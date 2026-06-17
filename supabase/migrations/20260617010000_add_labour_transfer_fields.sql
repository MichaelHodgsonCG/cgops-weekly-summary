/*
  Add labour transfer fields to weekly_chef_summary to support the
  Guided Weekly Package's Labour Transfers calculator (Section 1, Step 2).
*/

ALTER TABLE weekly_chef_summary
  ADD COLUMN IF NOT EXISTS labour_transfer_vacation numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labour_transfer_management numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labour_transfer_other numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labour_transfer_notes text DEFAULT '';
