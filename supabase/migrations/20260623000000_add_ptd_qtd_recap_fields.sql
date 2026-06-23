/*
  # Add PTD/QTD recap fields to weekly_chef_summary

  1. Changes
    - Adds sales_ptd_actual, theoretical_fc_ptd_pct, theoretical_fc_qtd_pct,
      and budget_food_cost_qtd_pct columns to weekly_chef_summary
    - These back the PTD/QTD Sales and Food Cost trend tables on the Chef
      Summary PDF, which previously had no data source and rendered as dashes

  2. Notes
    - Defaults to 0 so existing rows remain valid
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_chef_summary' AND column_name = 'sales_ptd_actual'
  ) THEN
    ALTER TABLE weekly_chef_summary ADD COLUMN sales_ptd_actual numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_chef_summary' AND column_name = 'theoretical_fc_ptd_pct'
  ) THEN
    ALTER TABLE weekly_chef_summary ADD COLUMN theoretical_fc_ptd_pct numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_chef_summary' AND column_name = 'theoretical_fc_qtd_pct'
  ) THEN
    ALTER TABLE weekly_chef_summary ADD COLUMN theoretical_fc_qtd_pct numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_chef_summary' AND column_name = 'budget_food_cost_qtd_pct'
  ) THEN
    ALTER TABLE weekly_chef_summary ADD COLUMN budget_food_cost_qtd_pct numeric DEFAULT 0;
  END IF;
END $$;
