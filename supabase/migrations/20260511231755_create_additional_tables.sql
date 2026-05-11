/*
  # Create Additional Tables

  1. New Tables
    - `guest_feedback` - Guest reviews from various sources
      - `id` (uuid, primary key)
      - `location_name` (text)
      - `review_date` / `report_date` (date)
      - `reviewer_name` (text, nullable)
      - `review_source` (text) - Google, OpenTable, etc.
      - Ratings (overall, food, service, ambience, value)
      - `review_text` (text, nullable)
      - `raw_email_id` (uuid, FK to raw_emails, nullable)
      - Unique constraint on (location_name, reviewer_name, review_date, review_source)

    - `location_mappings` - Normalize location names from different sources
      - `id` (uuid, primary key)
      - `source_name` (text, unique)
      - `canonical_location_id` (uuid, FK to locations, nullable)
      - `canonical_location_name` (text)

    - `fiscal_calendar` - Fiscal year period/week definitions
      - `id` (uuid, primary key)
      - `fiscal_year` / `period` / `week` (integers)
      - `start_date` / `end_date` (date)
      - `is_current` (boolean)
      - Unique constraint on (fiscal_year, period, week)

    - `daily_insights` - AI-generated daily analysis summaries
      - `id` (uuid, primary key)
      - `analysis_date` (date, unique)
      - JSON columns for summary, concerns, highlights, themes, opportunities
      - Counts and metadata

    - `dismissed_alerts` - Per-user alert dismissals
      - `id` (uuid, primary key)
      - `user_id` (text)
      - `location_name` (text)
      - `dismissed_at` (timestamptz)

    - `user_location_preferences` - Per-user location filter preferences
      - `id` (uuid, primary key)
      - `user_id` (text)
      - `location_name` (text)

  2. Security
    - RLS enabled on all tables
    - Policies for authenticated access
*/

-- Guest Feedback table
CREATE TABLE IF NOT EXISTS guest_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_name text NOT NULL,
  review_date date NOT NULL,
  report_date date NOT NULL,
  reviewer_name text,
  review_source text NOT NULL,
  overall_rating numeric(3,2),
  food_rating numeric(3,2),
  service_rating numeric(3,2),
  ambience_rating numeric(3,2),
  value_rating numeric(3,2),
  review_text text,
  visit_date timestamptz,
  raw_email_id uuid REFERENCES raw_emails(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(location_name, reviewer_name, review_date, review_source)
);

CREATE INDEX IF NOT EXISTS idx_guest_feedback_location ON guest_feedback(location_name);
CREATE INDEX IF NOT EXISTS idx_guest_feedback_review_date ON guest_feedback(review_date DESC);
CREATE INDEX IF NOT EXISTS idx_guest_feedback_location_date ON guest_feedback(location_name, review_date DESC);

ALTER TABLE guest_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view guest_feedback"
  ON guest_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert guest_feedback"
  ON guest_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update guest_feedback"
  ON guest_feedback FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete guest_feedback"
  ON guest_feedback FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Location Mappings table
CREATE TABLE IF NOT EXISTS location_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text UNIQUE NOT NULL,
  canonical_location_id uuid REFERENCES locations(id),
  canonical_location_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_location_mappings_source_name ON location_mappings(source_name);
CREATE INDEX IF NOT EXISTS idx_location_mappings_canonical_id ON location_mappings(canonical_location_id);

ALTER TABLE location_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view location_mappings"
  ON location_mappings FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert location_mappings"
  ON location_mappings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update location_mappings"
  ON location_mappings FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete location_mappings"
  ON location_mappings FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Fiscal Calendar table
CREATE TABLE IF NOT EXISTS fiscal_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year integer NOT NULL,
  period integer NOT NULL CHECK (period >= 1 AND period <= 13),
  week integer NOT NULL CHECK (week >= 1 AND week <= 4),
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(fiscal_year, period, week)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_calendar_year_period_week ON fiscal_calendar(fiscal_year, period, week);
CREATE INDEX IF NOT EXISTS idx_fiscal_calendar_dates ON fiscal_calendar(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_fiscal_calendar_current ON fiscal_calendar(is_current) WHERE is_current = true;

ALTER TABLE fiscal_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fiscal_calendar"
  ON fiscal_calendar FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert fiscal_calendar"
  ON fiscal_calendar FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update fiscal_calendar"
  ON fiscal_calendar FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete fiscal_calendar"
  ON fiscal_calendar FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Trigger for fiscal_calendar updated_at
CREATE OR REPLACE FUNCTION update_fiscal_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fiscal_calendar_updated_at
  BEFORE UPDATE ON fiscal_calendar
  FOR EACH ROW
  EXECUTE FUNCTION update_fiscal_calendar_updated_at();

-- Daily Insights table (AI-generated daily summaries)
CREATE TABLE IF NOT EXISTS daily_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_date date UNIQUE NOT NULL,
  ai_summary_json jsonb DEFAULT '{}'::jsonb,
  concerns_json jsonb DEFAULT '[]'::jsonb,
  highlights_json jsonb DEFAULT '[]'::jsonb,
  management_opportunities_json jsonb DEFAULT '[]'::jsonb,
  themes_json jsonb DEFAULT '[]'::jsonb,
  missing_locations text[] DEFAULT '{}',
  concerns_count integer DEFAULT 0,
  highlights_count integer DEFAULT 0,
  management_opportunities_count integer DEFAULT 0,
  missing_locations_count integer DEFAULT 0,
  ai_provider text DEFAULT 'openai',
  processing_duration_ms integer,
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE daily_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view daily_insights"
  ON daily_insights FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert daily_insights"
  ON daily_insights FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update daily_insights"
  ON daily_insights FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete daily_insights"
  ON daily_insights FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Dismissed Alerts table
CREATE TABLE IF NOT EXISTS dismissed_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  location_name text NOT NULL,
  dismissed_at timestamptz DEFAULT now(),
  latest_review_date date,
  dismissed_review_ids text[] DEFAULT '{}',
  UNIQUE (user_id, location_name)
);

ALTER TABLE dismissed_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view dismissed_alerts"
  ON dismissed_alerts FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert dismissed_alerts"
  ON dismissed_alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update dismissed_alerts"
  ON dismissed_alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete dismissed_alerts"
  ON dismissed_alerts FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- User Location Preferences table
CREATE TABLE IF NOT EXISTS user_location_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  location_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, location_name)
);

ALTER TABLE user_location_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view user_location_preferences"
  ON user_location_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert user_location_preferences"
  ON user_location_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete user_location_preferences"
  ON user_location_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
