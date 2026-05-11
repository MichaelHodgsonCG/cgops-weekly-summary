/*
  # Create Weekly Chef Summary and Executive Reports Tables

  1. New Tables
    - `weekly_chef_summary` - Comprehensive weekly operational report per location
      - `id` (uuid, primary key)
      - `location_id` (uuid, FK to locations)
      - `week_number` / `period_number` / `fiscal_year` (integers)
      - Food cost metrics (budget, actual, variance, theoretical, on-hand, usage)
      - Sage/QTD financial data
      - Labour metrics (budget, actual, variance, overtime)
      - EBITDA metrics
      - QSR timing data
      - Staffing levels (ideal vs current for cooks, prep, dish, other)
      - Text summaries (food cost, labour, promo, notes, action plans)
      - JSON arrays (feature_items, hires, terminated)
      - Calculated savings targets

    - `weekly_executive_reports` - Consolidated weekly report for leadership
      - `id` (uuid, primary key)
      - `fiscal_year` / `period_number` / `week_number` (integers)
      - Brand summaries (executive, beertown, trinity, sole)
      - `action_plan` (text)
      - `consolidated_metrics` (jsonb)
      - `status` (text, 'draft' or 'final')
      - `finalized_at` (timestamptz, nullable)
      - `created_at` / `updated_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Policies for authenticated access
*/

-- Weekly Chef Summary table
CREATE TABLE IF NOT EXISTS weekly_chef_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id),
  week_number integer NOT NULL,
  period_number integer NOT NULL,
  fiscal_year integer NOT NULL DEFAULT 2026,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Food cost metrics
  budget_food_cost_pct numeric DEFAULT 0,
  actual_food_cost_pct numeric DEFAULT 0,
  fc_variance numeric DEFAULT 0,
  theoretical_food_cost_pct numeric DEFAULT 0,
  on_hand_amount numeric DEFAULT 0,
  theoretical_variance numeric DEFAULT 0,

  -- Sage / QTD financial
  sage_food_sales_qtd numeric DEFAULT 0,
  sage_fcost_qtd_pct numeric DEFAULT 0,
  food_cost_ptd_pct numeric DEFAULT 0,
  sage_sales_budget_qtd numeric DEFAULT 0,
  fc_qtd_pct numeric DEFAULT 0,
  qtd_variance_pct numeric DEFAULT 0,
  usage_amount numeric DEFAULT 0,
  ideal_usage_amount numeric DEFAULT 0,
  cogs_qtd numeric DEFAULT 0,
  food_sales_silverware numeric DEFAULT 0,
  food_sales_oc numeric DEFAULT 0,
  week_variance_amount numeric DEFAULT 0,
  budget_food_sales_period numeric DEFAULT 0,
  week_budget numeric DEFAULT 0,
  qtd_variance_amount numeric DEFAULT 0,

  -- Labour metrics
  labour_budget_pct numeric DEFAULT 0,
  labour_cost_pct numeric DEFAULT 0,
  lc_variance numeric DEFAULT 0,
  sage_labour_budget_qtd_pct numeric DEFAULT 0,
  sage_lcost_qtd_pct numeric DEFAULT 0,
  labour_cost_ptd_pct numeric DEFAULT 0,
  labour_qtd_pct numeric DEFAULT 0,
  lab_ptd_var_amount numeric DEFAULT 0,
  qtd_labour_variance_pct numeric DEFAULT 0,
  labour_spent numeric DEFAULT 0,
  overtime_amount numeric DEFAULT 0,
  lab_qtd_var_amount numeric DEFAULT 0,

  -- EBITDA
  ebidta_budget_period_pct numeric DEFAULT 0,
  ebidta_ptd_pct numeric DEFAULT 0,
  ebidta_variance_pct numeric DEFAULT 0,

  -- QSR timing
  qsr_weekend_lunch_time text DEFAULT ''::text,
  qsr_expo_time text DEFAULT ''::text,

  -- Financial
  teamshare_amount numeric DEFAULT 0,
  petty_cash numeric DEFAULT 0,
  waste_amount numeric DEFAULT 0,
  last_audit_score_pct numeric DEFAULT 0,
  boh_promo_amount numeric DEFAULT 0,
  promo_ptd numeric DEFAULT 0,
  promo_qtd numeric DEFAULT 0,

  -- Planning
  weeks_remaining_in_qtr integer DEFAULT 0,
  sous_vac_days integer DEFAULT 0,

  -- Savings targets
  fc_need_save_per_week numeric DEFAULT 0,
  fc_need_save_per_day numeric DEFAULT 0,
  labour_need_save_per_week numeric DEFAULT 0,
  labour_need_save_per_day numeric DEFAULT 0,

  -- Staffing
  ideal_cooks integer DEFAULT 0,
  current_cooks integer DEFAULT 0,
  ideal_prep integer DEFAULT 0,
  current_prep integer DEFAULT 0,
  ideal_dish integer DEFAULT 0,
  current_dish integer DEFAULT 0,
  ideal_other integer DEFAULT 0,
  current_other integer DEFAULT 0,
  hiring_notes text DEFAULT ''::text,
  tm_mots_of_note text DEFAULT ''::text,
  development_path_updates text DEFAULT ''::text,

  -- Text summaries
  food_cost_summary text DEFAULT ''::text,
  labour_summary text DEFAULT ''::text,
  boh_promo_summary text DEFAULT ''::text,
  notes text DEFAULT ''::text,
  action_plan_summary text DEFAULT ''::text,
  rm_issues_cleaning_focus text DEFAULT ''::text,
  ai_summary text,

  -- JSON arrays
  feature_items jsonb DEFAULT '[]'::jsonb,
  hires jsonb DEFAULT '[]'::jsonb,
  terminated jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE weekly_chef_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view weekly_chef_summary"
  ON weekly_chef_summary FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert weekly_chef_summary"
  ON weekly_chef_summary FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update weekly_chef_summary"
  ON weekly_chef_summary FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete weekly_chef_summary"
  ON weekly_chef_summary FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Weekly Executive Reports table
CREATE TABLE IF NOT EXISTS weekly_executive_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year integer NOT NULL,
  period_number integer NOT NULL,
  week_number integer NOT NULL,
  executive_summary text DEFAULT ''::text,
  beertown_summary text DEFAULT ''::text,
  trinity_summary text DEFAULT ''::text,
  sole_summary text DEFAULT ''::text,
  action_plan text DEFAULT ''::text,
  consolidated_metrics jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'final'::text])),
  finalized_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE weekly_executive_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view weekly_executive_reports"
  ON weekly_executive_reports FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert weekly_executive_reports"
  ON weekly_executive_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update weekly_executive_reports"
  ON weekly_executive_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete weekly_executive_reports"
  ON weekly_executive_reports FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
