import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Location = {
  id: string;
  name: string;
  code: string;
  exclude_from_reporting: boolean;
  created_at: string;
};

export type PLUpload = {
  id: string;
  location_id: string;
  week_ending_date: string;
  uploaded_at: string;
  filename: string;
  status: string;
  created_at: string;
};

export type PLLineItem = {
  id: string;
  upload_id: string;
  location_id: string;
  week_ending_date: string;
  line_item_name: string;
  current_actual: number | null;
  current_actual_pct: number | null;
  current_budget: number | null;
  current_budget_pct: number | null;
  prior_year: number | null;
  prior_year_pct: number | null;
  ytd_actual: number | null;
  ytd_actual_pct: number | null;
  ytd_budget: number | null;
  ytd_budget_pct: number | null;
  prior_ytd: number | null;
  prior_ytd_pct: number | null;
  qtd_actual: number | null;
  qtd_actual_pct: number | null;
  qtd_budget: number | null;
  qtd_budget_pct: number | null;
  created_at: string;
};

export type Permission = {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  created_at: string;
};

export type RolePermission = {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
};

const regionDisplayNames: Record<string, string> = {
  Beertown: 'Beertown/SKT',
  Signature: 'Trinity',
};

export function getRegionDisplayName(region: string): string {
  return regionDisplayNames[region] || region;
}
