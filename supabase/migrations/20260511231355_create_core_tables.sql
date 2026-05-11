/*
  # Create Core Tables

  1. New Tables
    - `locations` - Restaurant locations with metadata
      - `id` (uuid, primary key)
      - `name` (text) - Location name
      - `code` (text, unique) - Short code identifier
      - `region` (text, nullable) - Geographic region
      - `format_type` (text, nullable) - Restaurant format/brand
      - `square_footage` (integer, nullable)
      - `seating_capacity` (integer, nullable)
      - `opening_date` (date, nullable)
      - `market_tier` (text, nullable) - Market classification
      - `exclude_from_reporting` (boolean, default false)
      - `created_at` (timestamptz)

    - `pl_uploads` - P&L file upload records
      - `id` (uuid, primary key)
      - `location_id` (uuid, FK to locations)
      - `week_ending_date` (date)
      - `uploaded_at` (timestamptz)
      - `filename` (text)
      - `status` (text, default 'completed')
      - `created_at` (timestamptz)

    - `pl_line_items` - Individual P&L line items from uploads
      - `id` (uuid, primary key)
      - `upload_id` (uuid, FK to pl_uploads)
      - `location_id` (uuid, FK to locations)
      - `week_ending_date` (date)
      - `line_item_name` (text)
      - Various actual/budget/prior year columns (numeric)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Policies for authenticated access
*/

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  region text,
  format_type text,
  square_footage integer,
  seating_capacity integer,
  opening_date date,
  market_tier text,
  exclude_from_reporting boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view locations"
  ON locations FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert locations"
  ON locations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update locations"
  ON locations FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete locations"
  ON locations FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- P&L Uploads table
CREATE TABLE IF NOT EXISTS pl_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id),
  week_ending_date date NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  filename text NOT NULL,
  status text DEFAULT 'completed'::text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pl_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pl_uploads"
  ON pl_uploads FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert pl_uploads"
  ON pl_uploads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update pl_uploads"
  ON pl_uploads FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete pl_uploads"
  ON pl_uploads FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- P&L Line Items table
CREATE TABLE IF NOT EXISTS pl_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES pl_uploads(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  week_ending_date date NOT NULL,
  line_item_name text NOT NULL,
  current_actual numeric,
  current_actual_pct numeric,
  current_budget numeric,
  current_budget_pct numeric,
  prior_year numeric,
  prior_year_pct numeric,
  ytd_actual numeric,
  ytd_actual_pct numeric,
  ytd_budget numeric,
  ytd_budget_pct numeric,
  prior_ytd numeric,
  prior_ytd_pct numeric,
  qtd_actual numeric,
  qtd_actual_pct numeric,
  qtd_budget numeric,
  qtd_budget_pct numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pl_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pl_line_items"
  ON pl_line_items FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert pl_line_items"
  ON pl_line_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update pl_line_items"
  ON pl_line_items FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete pl_line_items"
  ON pl_line_items FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
