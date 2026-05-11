/*
  # Create Email and Daily Logbook Tables

  1. New Tables
    - `raw_emails` - Stores incoming emails for processing
      - `id` (uuid, primary key)
      - `received_at` (timestamptz)
      - `subject` (text, default '')
      - `from_email` (text, default '')
      - `to_email` (text, default '')
      - `body_plain` (text, nullable, default '')
      - `body_html` (text, nullable)
      - `raw_json` (jsonb, default '{}')
      - `created_at` (timestamptz)

    - `daily_logbook` - Daily operational log per location
      - `id` (uuid, primary key)
      - `location_id` (uuid, FK to locations, nullable)
      - `location_name` (text, default '')
      - `report_date` (date)
      - Sales, labor, MTD, prior year metrics
      - Weather data (high, low, conditions)
      - `journal_entry` (text, nullable)
      - `raw_email_id` (uuid, FK to raw_emails, nullable)
      - `created_at` / `updated_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Policies for authenticated access
*/

-- Raw Emails table
CREATE TABLE IF NOT EXISTS raw_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz DEFAULT now(),
  subject text NOT NULL DEFAULT ''::text,
  from_email text NOT NULL DEFAULT ''::text,
  to_email text NOT NULL DEFAULT ''::text,
  body_plain text DEFAULT ''::text,
  body_html text,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE raw_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view raw_emails"
  ON raw_emails FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert raw_emails"
  ON raw_emails FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update raw_emails"
  ON raw_emails FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete raw_emails"
  ON raw_emails FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Daily Logbook table
CREATE TABLE IF NOT EXISTS daily_logbook (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES locations(id),
  location_name text NOT NULL DEFAULT ''::text,
  report_date date NOT NULL,
  sales_forecast numeric,
  sales_actual numeric,
  variance_forecast_to_sales numeric,
  scheduled_labor numeric,
  actual_labor numeric,
  labor_cost_vs_sales_forecast numeric,
  labor_cost_vs_sales_actual numeric,
  mtd_forecast numeric,
  mtd_sales numeric,
  variance_mtd_forecast_to_sales numeric,
  sales_actual_previous_year numeric,
  actual_labor_cost_previous_year numeric,
  weather_high numeric,
  weather_low numeric,
  weather_conditions text,
  journal_entry text,
  raw_email_id uuid REFERENCES raw_emails(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE daily_logbook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view daily_logbook"
  ON daily_logbook FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert daily_logbook"
  ON daily_logbook FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update daily_logbook"
  ON daily_logbook FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete daily_logbook"
  ON daily_logbook FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
