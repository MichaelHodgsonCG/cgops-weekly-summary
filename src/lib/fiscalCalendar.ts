import { supabase } from './supabase';

export interface FiscalWeek {
  id: string;
  fiscal_year: number;
  period: number;
  week: number;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export async function getCurrentFiscalPeriod(): Promise<FiscalWeek | null> {
  try {
    const { data, error } = await supabase
      .from('fiscal_calendar')
      .select('*')
      .eq('is_current', true)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching current fiscal period:', error);
    return null;
  }
}

export async function getFiscalPeriodForDate(date: Date): Promise<FiscalWeek | null> {
  try {
    const dateStr = date.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('fiscal_calendar')
      .select('*')
      .lte('start_date', dateStr)
      .gte('end_date', dateStr)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching fiscal period for date:', error);
    return null;
  }
}

export async function getFiscalYear(year: number): Promise<FiscalWeek[]> {
  try {
    const { data, error } = await supabase
      .from('fiscal_calendar')
      .select('*')
      .eq('fiscal_year', year)
      .order('period', { ascending: true })
      .order('week', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching fiscal year:', error);
    return [];
  }
}

export async function getFiscalPeriodWeeks(
  year: number,
  period: number
): Promise<FiscalWeek[]> {
  try {
    const { data, error } = await supabase
      .from('fiscal_calendar')
      .select('*')
      .eq('fiscal_year', year)
      .eq('period', period)
      .order('week', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching fiscal period weeks:', error);
    return [];
  }
}

export function formatFiscalPeriod(week: FiscalWeek): string {
  return `FY${week.fiscal_year} P${week.period}W${week.week}`;
}

export function formatFiscalPeriodShort(week: FiscalWeek): string {
  return `P${week.period}W${week.week}`;
}

export function getFiscalPeriodDateRange(week: FiscalWeek): string {
  const startDate = new Date(week.start_date + 'T00:00:00');
  const endDate = new Date(week.end_date + 'T00:00:00');

  return `${startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })} - ${endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })}`;
}

export async function getAllFiscalYears(): Promise<number[]> {
  try {
    const { data, error } = await supabase
      .from('fiscal_calendar')
      .select('fiscal_year')
      .order('fiscal_year', { ascending: false });

    if (error) throw error;

    const uniqueYears = [...new Set(data?.map(d => d.fiscal_year) || [])];
    return uniqueYears;
  } catch (error) {
    console.error('Error fetching fiscal years:', error);
    return [];
  }
}

export function isDateInFiscalPeriod(date: Date, week: FiscalWeek): boolean {
  const checkDate = new Date(date);
  const startDate = new Date(week.start_date + 'T00:00:00');
  const endDate = new Date(week.end_date + 'T00:00:00');

  checkDate.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  return checkDate >= startDate && checkDate <= endDate;
}
