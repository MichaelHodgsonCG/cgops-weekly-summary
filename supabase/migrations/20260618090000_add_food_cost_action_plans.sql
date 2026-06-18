/*
  # Create Food Cost Action Plan (FCAP) table

  1. New Tables
    - `food_cost_action_plans` - Shared Top-10 variance action plan per location/period
      - `id` (uuid, primary key)
      - `location_id` (uuid, FK to locations)
      - `fiscal_year` / `period_number` (integers)
      - `items` (jsonb array of variance-reduction line items, editable week to week)
      - `created_at` / `updated_at` (timestamptz)
      - Unique on (location_id, fiscal_year, period_number) so the same plan
        is shared and updated across all 4 weeks of a period rather than
        duplicated per week.

  2. Security
    - RLS enabled
    - Policies for authenticated access
*/

CREATE TABLE IF NOT EXISTS food_cost_action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id),
  fiscal_year integer NOT NULL,
  period_number integer NOT NULL,
  items jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (location_id, fiscal_year, period_number)
);

ALTER TABLE food_cost_action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view food_cost_action_plans"
  ON food_cost_action_plans FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert food_cost_action_plans"
  ON food_cost_action_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update food_cost_action_plans"
  ON food_cost_action_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete food_cost_action_plans"
  ON food_cost_action_plans FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
