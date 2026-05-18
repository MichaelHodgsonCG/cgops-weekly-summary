/*
  # Add unique constraint to weekly_chef_summary

  1. Changes
    - Adds a unique constraint on (location_id, fiscal_year, period_number, week_number) 
      to the weekly_chef_summary table
    - This is required for the upsert operation used when chefs save their summaries

  2. Notes
    - Without this constraint, the Supabase upsert with onConflict fails
    - Each location should only have one summary per fiscal year/period/week combination
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'weekly_chef_summary_location_period_week_unique'
  ) THEN
    ALTER TABLE weekly_chef_summary 
      ADD CONSTRAINT weekly_chef_summary_location_period_week_unique 
      UNIQUE (location_id, fiscal_year, period_number, week_number);
  END IF;
END $$;
