/*
  # Create Analytics Tables

  1. New Tables
    - `performance_benchmarks` - Target metrics by market tier
      - `id` (uuid, primary key)
      - `metric_name` (text)
      - `market_tier` (text, nullable)
      - `target_value` (numeric)
      - `rolling_13wk_avg` (numeric, nullable)
      - `best_in_class` (numeric, nullable)
      - `effective_date` (date)
      - `created_at` (timestamptz)

    - `location_rankings` - Weekly composite rankings per location
      - `id` (uuid, primary key)
      - `location_id` (uuid, FK to locations)
      - `week_ending_date` (date)
      - Rankings and values for food sales, food cost, labor, EBITDA
      - `composite_score` (numeric, nullable)
      - `rank_change_from_prior_week` (integer, nullable)
      - `created_at` (timestamptz)

    - `location_groups` - Named groupings of locations
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text, nullable)
      - `group_type` (text, default 'custom')
      - `created_at` (timestamptz)

    - `location_group_members` - Many-to-many linking locations to groups
      - `id` (uuid, primary key)
      - `group_id` (uuid, FK to location_groups)
      - `location_id` (uuid, FK to locations)
      - `created_at` (timestamptz)

    - `performance_alerts` - Triggered alerts when metrics exceed thresholds
      - `id` (uuid, primary key)
      - `location_id` (uuid, FK to locations)
      - `week_ending_date` (date)
      - `alert_type` (text)
      - `metric_name` (text)
      - `threshold_value` / `actual_value` (numeric, nullable)
      - `severity` (text, default 'medium')
      - `message` (text)
      - `acknowledged` (boolean, default false)
      - `acknowledged_at` (timestamptz, nullable)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Policies for authenticated access
*/

-- Performance Benchmarks table
CREATE TABLE IF NOT EXISTS performance_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  market_tier text,
  target_value numeric NOT NULL,
  rolling_13wk_avg numeric,
  best_in_class numeric,
  effective_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE performance_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view performance_benchmarks"
  ON performance_benchmarks FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert performance_benchmarks"
  ON performance_benchmarks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update performance_benchmarks"
  ON performance_benchmarks FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete performance_benchmarks"
  ON performance_benchmarks FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Location Rankings table
CREATE TABLE IF NOT EXISTS location_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id),
  week_ending_date date NOT NULL,
  food_sales_rank integer,
  food_sales_value numeric,
  food_cost_pct_rank integer,
  food_cost_pct_value numeric,
  labor_pct_rank integer,
  labor_pct_value numeric,
  ebitda_budget_var_rank integer,
  ebitda_budget_var_value numeric,
  composite_score numeric,
  rank_change_from_prior_week integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE location_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view location_rankings"
  ON location_rankings FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert location_rankings"
  ON location_rankings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update location_rankings"
  ON location_rankings FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete location_rankings"
  ON location_rankings FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Location Groups table
CREATE TABLE IF NOT EXISTS location_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  group_type text DEFAULT 'custom'::text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE location_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view location_groups"
  ON location_groups FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert location_groups"
  ON location_groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update location_groups"
  ON location_groups FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete location_groups"
  ON location_groups FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Location Group Members table
CREATE TABLE IF NOT EXISTS location_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES location_groups(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE location_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view location_group_members"
  ON location_group_members FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert location_group_members"
  ON location_group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update location_group_members"
  ON location_group_members FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete location_group_members"
  ON location_group_members FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Performance Alerts table
CREATE TABLE IF NOT EXISTS performance_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id),
  week_ending_date date NOT NULL,
  alert_type text NOT NULL,
  metric_name text NOT NULL,
  threshold_value numeric,
  actual_value numeric,
  severity text DEFAULT 'medium'::text,
  message text NOT NULL,
  acknowledged boolean DEFAULT false,
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view performance_alerts"
  ON performance_alerts FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert performance_alerts"
  ON performance_alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update performance_alerts"
  ON performance_alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete performance_alerts"
  ON performance_alerts FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
