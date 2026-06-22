/*
  Add COGs checklist fields to weekly_chef_summary to support the Guided
  Weekly Package's COGs step (Section 3, Step 1), where chefs confirm
  completion of the weekly Optimum Control tasks: Confirm Sales, Brownie
  on Us, Recording Waste, Entering Petty Cash, and Internal Transfers.
*/

ALTER TABLE weekly_chef_summary
  ADD COLUMN IF NOT EXISTS cogs_confirm_sales boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cogs_brownie_on_us boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cogs_recording_waste boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cogs_petty_cash_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cogs_internal_transfers boolean DEFAULT false;
