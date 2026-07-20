import { supabase } from './supabase';
import {
  exportChefSummaryToPdf,
  FoodCostCategoryRow,
  FcapRow,
  NextPeriodFcap,
  WeekAheadAction,
} from './chefSummaryExport';

export type ChefSummaryReportResult =
  | { ok: true; url?: string }
  | { ok: false; error: string };

/**
 * Build the full Chef Summary report PDF for one location/week straight from the
 * saved `weekly_summary_chef_summary` row (plus its actions + FCAP). This is the
 * single source of truth for the report so the HQ Executive Report and the
 * chef's own "Regenerate PDF" button always produce identical output — and it
 * always reflects the latest saved numbers, so a corrected P&L/GL shows up as
 * soon as the chef has re-saved the food-cost step.
 *
 * outputMode 'save' downloads the file; 'bloburl' returns an object URL for
 * in-app viewing.
 */
export async function buildChefSummaryReport(
  locationId: string,
  locationName: string,
  fiscalYear: number,
  period: number,
  week: number,
  outputMode: 'save' | 'bloburl' = 'save'
): Promise<ChefSummaryReportResult> {
  const { data: row } = await supabase
    .from('weekly_summary_chef_summary')
    .select('*')
    .eq('location_id', locationId)
    .eq('fiscal_year', fiscalYear)
    .eq('period_number', period)
    .eq('week_number', week)
    .maybeSingle();

  if (!row) {
    return { ok: false, error: `No saved summary for ${locationName} (FY${fiscalYear} P${period} W${week}).` };
  }

  const { data: cal } = await supabase
    .from('fiscal_calendar')
    .select('end_date')
    .eq('fiscal_year', fiscalYear)
    .eq('period', period)
    .eq('week', week)
    .maybeSingle();
  const weekEndingDate = cal?.end_date as string | undefined;

  const sales = row.food_sales_labour_push || 0;
  const actualFoodCostPct = sales > 0 ? (row.usage_amount / sales) * 100 : 0;
  const fcVariance = actualFoodCostPct - (row.budget_food_cost_pct || 0);
  const theoreticalFoodCostPct = sales > 0 ? (row.ideal_usage_amount / sales) * 100 : 0;
  const theoreticalVariance = actualFoodCostPct - theoreticalFoodCostPct;
  const labourCostPct = sales > 0 ? (row.labour_spent / sales) * 100 : 0;
  const lcVariance = labourCostPct - (row.labour_budget_pct || 0);
  const weekBudget = row.budget_food_sales_period > 0 ? row.budget_food_sales_period / 4 : (row.week_budget || 0);

  let foodCostCategories: FoodCostCategoryRow[] | undefined;
  try {
    const parsed = JSON.parse(row.final_food_cost_items || '[]');
    const categories = Array.isArray(parsed) ? parsed : parsed?.categories;
    if (Array.isArray(categories) && categories.length > 0) {
      foodCostCategories = categories.map((c: Record<string, unknown>) => ({
        category: String(c.category ?? ''),
        opening: Number(c.opening) || 0,
        glPurchases: Number(c.glPurchases) || 0,
        closing: Number(c.closing) || 0,
        waste: Number(c.waste) || 0,
        actualUsage: Number(c.actualUsage) || 0,
        idealUsage: Number(c.idealUsage) || 0,
        variance: Number(c.variance) || 0,
      }));
    }
  } catch {
    foodCostCategories = undefined;
  }

  const { data: actionRows } = await supabase
    .from('weekly_summary_actions')
    .select('action_text, owner, due_by, sort_order')
    .eq('location_id', locationId)
    .eq('fiscal_year', fiscalYear)
    .eq('period_number', period)
    .eq('week_number', week)
    .order('sort_order', { ascending: true });
  const weekAheadActions: WeekAheadAction[] = (actionRows || [])
    .filter(a => a.action_text && a.action_text.trim())
    .map(a => ({ action_text: a.action_text, owner: a.owner ?? '', due_by: a.due_by ?? '' }));

  const { data: fcapRow } = await supabase
    .from('weekly_summary_food_cost_action_plans')
    .select('items')
    .eq('location_id', locationId)
    .eq('fiscal_year', fiscalYear)
    .eq('period_number', period)
    .maybeSingle();
  const fcapItems: FcapRow[] = Array.isArray(fcapRow?.items) ? (fcapRow!.items as FcapRow[]) : [];

  // If this is the period's last week, next period's FCAP (created in the guided
  // workflow at period end) rides along in the same PDF.
  let nextPeriodFcap: NextPeriodFcap | undefined;
  const { data: periodWeeks } = await supabase
    .from('fiscal_calendar')
    .select('week')
    .eq('fiscal_year', fiscalYear)
    .eq('period', period);
  const lastWeek = periodWeeks && periodWeeks.length > 0 ? Math.max(...periodWeeks.map((w) => w.week)) : 4;
  if (week >= lastWeek) {
    const nextFiscalYear = period === 13 ? fiscalYear + 1 : fiscalYear;
    const nextPeriodNumber = period === 13 ? 1 : period + 1;
    const { data: nextFcapRow } = await supabase
      .from('weekly_summary_food_cost_action_plans')
      .select('items')
      .eq('location_id', locationId)
      .eq('fiscal_year', nextFiscalYear)
      .eq('period_number', nextPeriodNumber)
      .maybeSingle();
    const nextItems: FcapRow[] = Array.isArray(nextFcapRow?.items) ? (nextFcapRow!.items as FcapRow[]) : [];
    if (nextItems.length > 0) {
      nextPeriodFcap = { items: nextItems, fiscalYear: nextFiscalYear, periodNumber: nextPeriodNumber };
    }
  }

  const url = exportChefSummaryToPdf(
    row, locationName, weekBudget, actualFoodCostPct, fcVariance, theoreticalFoodCostPct,
    theoreticalVariance, labourCostPct, lcVariance, undefined, weekEndingDate,
    sales, weekBudget, actualFoodCostPct, labourCostPct,
    foodCostCategories, weekAheadActions, fcapItems, outputMode, nextPeriodFcap
  ) as string | void;

  return { ok: true, url: outputMode === 'bloburl' ? (url as string) : undefined };
}
