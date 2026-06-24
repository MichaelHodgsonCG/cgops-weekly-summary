/*
  # Create Weekly Actions ("Actions for the Week Ahead") table

  1. New Tables
    - `weekly_actions` - One row per committed forward action for a location/week.
      - `id` (uuid, primary key)
      - `location_id` (uuid, FK to locations)
      - `fiscal_year` / `period_number` / `week_number` (integers) - the week the
        action was committed in (i.e. the week the chef plans to action it).
      - `action_text` (text) - the concrete action.
      - `source_section` (text) - which guided section the action came from
        (e.g. 'sales', 'labour', 'food_cost', 'team', 'facilities', 'manual').
      - `owner` (text) - who is responsible.
      - `due_by` (text) - free-text target (e.g. 'Fri', 'by close Saturday').
      - `status` (text) - 'open' when committed, then updated the following week to
        'done' / 'carried' / 'dropped' to close the accountability loop.
      - `sort_order` (integer) - display order within the week.
      - `created_at` / `updated_at` (timestamptz)

  2. Security
    - RLS enabled
    - Policies grant the `anon` role full CRUD. This app uses a custom PIN-based
      auth (see 20260512001316_fix_rls_policies_for_anon_access) and the Supabase
      client always connects as `anon`, so `auth.uid()` is NULL. Access control is
      enforced at the application layer.
*/

CREATE TABLE IF NOT EXISTS weekly_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id),
  fiscal_year integer NOT NULL,
  period_number integer NOT NULL,
  week_number integer NOT NULL,
  action_text text DEFAULT ''::text,
  source_section text DEFAULT ''::text,
  owner text DEFAULT ''::text,
  due_by text DEFAULT ''::text,
  status text DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'done'::text, 'carried'::text, 'dropped'::text])),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weekly_actions_location_week_idx
  ON weekly_actions (location_id, fiscal_year, period_number, week_number);

ALTER TABLE weekly_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to weekly_actions"
  ON weekly_actions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert access to weekly_actions"
  ON weekly_actions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow update access to weekly_actions"
  ON weekly_actions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to weekly_actions"
  ON weekly_actions FOR DELETE TO anon USING (true);
