/*
  # Create SLP (Sales, Labor, Promo) Tables

  1. New Tables
    - `slp_reports` - Parent table for daily SLP report uploads
      - `id` (uuid, primary key)
      - `report_date` (date)
      - `uploaded_at` (timestamptz)
      - `uploaded_by` (uuid, nullable)
      - `file_name` (text, nullable)
      - `created_at` (timestamptz)

    - `slp_sales_data` - Daily sales metrics per location
      - `id` (uuid, primary key)
      - `report_id` (uuid, FK to slp_reports)
      - `location_name` (text)
      - Sales totals, projections, and year-over-year comparisons

    - `slp_labor_data` - Daily labor metrics per location/department
      - `id` (uuid, primary key)
      - `report_id` (uuid, FK to slp_reports)
      - `location_name` (text)
      - `department` (text)
      - Labor budget, actual, projection percentages and dollar variances

    - `slp_promo_data` - Daily promo/comp metrics per location
      - `id` (uuid, primary key)
      - `report_id` (uuid, FK to slp_reports)
      - `location_name` (text)
      - Relationship dollars, substandard dollars, total promo percent

  2. Security
    - RLS enabled on all tables
    - Policies for authenticated access
*/

-- SLP Reports table
CREATE TABLE IF NOT EXISTS slp_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid,
  file_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE slp_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view slp_reports"
  ON slp_reports FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert slp_reports"
  ON slp_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update slp_reports"
  ON slp_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete slp_reports"
  ON slp_reports FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- SLP Sales Data table
CREATE TABLE IF NOT EXISTS slp_sales_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES slp_reports(id),
  location_name text NOT NULL,
  total_daily_sales numeric,
  total_wtd_sales numeric,
  daily_sales_vs_projections numeric,
  wtd_sales_vs_projections numeric,
  daily_sales_vs_last_year numeric,
  wtd_sales_vs_last_year numeric,
  wtd_sales_vs_last_year_pct numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE slp_sales_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view slp_sales_data"
  ON slp_sales_data FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert slp_sales_data"
  ON slp_sales_data FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update slp_sales_data"
  ON slp_sales_data FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete slp_sales_data"
  ON slp_sales_data FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- SLP Labor Data table
CREATE TABLE IF NOT EXISTS slp_labor_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES slp_reports(id),
  location_name text NOT NULL,
  department text NOT NULL,
  labour_budget_pct numeric,
  daily_labour_actual_pct numeric,
  wtd_labour_actual_pct numeric,
  daily_labour_projection_pct numeric,
  full_week_labour_projection_pct numeric,
  daily_labour_dollars_vs_projections numeric,
  wtd_labour_dollars_vs_projections numeric,
  wtd_labour_pct_vs_budget_pct numeric,
  wtd_labour_dollars_vs_sales numeric,
  wtd_labour_dollars numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE slp_labor_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view slp_labor_data"
  ON slp_labor_data FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert slp_labor_data"
  ON slp_labor_data FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update slp_labor_data"
  ON slp_labor_data FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete slp_labor_data"
  ON slp_labor_data FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- SLP Promo Data table
CREATE TABLE IF NOT EXISTS slp_promo_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES slp_reports(id),
  location_name text NOT NULL,
  relationship_dollars numeric,
  substandard_dollars numeric,
  total_promo_pct numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE slp_promo_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view slp_promo_data"
  ON slp_promo_data FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert slp_promo_data"
  ON slp_promo_data FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update slp_promo_data"
  ON slp_promo_data FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete slp_promo_data"
  ON slp_promo_data FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
