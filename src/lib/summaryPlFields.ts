import { supabase } from './supabase';

/**
 * The weekly_chef_summary fields that are derived from P&L data (rather than
 * entered by the chef). These are snapshotted into the summary so reports and
 * dashboards don't have to re-derive them — which means they go stale when a
 * P&L is uploaded after the summary was saved. recomputeSummaryPlFields below
 * refreshes them straight from the latest P&L.
 */
export type PlDrivenSummaryFields = {
  budget_food_sales_period: number;
  sage_food_sales_qtd: number;
  sage_sales_budget_qtd: number;
  budget_food_cost_pct: number;
  labour_budget_pct: number;
  fc_qtd_pct: number;
  food_cost_ptd_pct: number;
  labour_qtd_pct: number;
  labour_cost_ptd_pct: number;
  sales_ptd_actual: number;
  budget_food_cost_qtd_pct: number;
  sage_labour_budget_qtd_pct: number;
};

function getQuarterPeriods(p: number): number[] {
  if (p <= 3) return [1, 2, 3];
  if (p <= 6) return [4, 5, 6];
  if (p <= 9) return [7, 8, 9];
  return [10, 11, 12];
}

type PlItem = {
  upload_id: string;
  line_item_name: string;
  current_actual: number | null;
  current_budget: number | null;
  current_actual_pct: number | null;
  current_budget_pct: number | null;
};

/**
 * Compute the P&L-driven summary fields for one location/week from the current
 * P&L data. Mirrors the logic the chef-summary save uses (fetchPLDataForPeriod +
 * fetchPTDFromPL): period budget from the latest upload in the period, QTD from
 * the latest upload per period across the quarter, and PTD actuals from this
 * specific week's upload. Returns null when there's no P&L for the quarter yet.
 */
export async function computePlDrivenSummaryFields(
  locationId: string,
  fiscalYear: number,
  period: number,
  week: number
): Promise<PlDrivenSummaryFields | null> {
  const quarterPeriods = getQuarterPeriods(period);

  const { data: calWeeks } = await supabase
    .from('fiscal_calendar')
    .select('end_date, period, week')
    .eq('fiscal_year', fiscalYear)
    .in('period', quarterPeriods)
    .order('period', { ascending: true })
    .order('week', { ascending: true });
  if (!calWeeks || calWeeks.length === 0) return null;

  const quarterEndDates = calWeeks.map((w) => w.end_date);
  const { data: uploads } = await supabase
    .from('pl_uploads')
    .select('id, week_ending_date')
    .eq('location_id', locationId)
    .in('week_ending_date', quarterEndDates)
    .order('week_ending_date', { ascending: true });
  if (!uploads || uploads.length === 0) return null;

  const uploadIds = uploads.map((u) => u.id);
  const { data: lineItems } = await supabase
    .from('pl_line_items')
    .select('upload_id, line_item_name, current_actual, current_budget, current_actual_pct, current_budget_pct')
    .in('upload_id', uploadIds)
    .in('line_item_name', ['Food Sales', 'Cost of Sales (Food)', 'Kitchen Labour']);
  if (!lineItems || lineItems.length === 0) return null;

  const items = lineItems as PlItem[];
  const periodOf = (endDate: string) => calWeeks.find((c) => c.end_date === endDate)?.period;
  const itemFor = (uploadId: string, name: string) =>
    items.find((i) => i.upload_id === uploadId && i.line_item_name === name);

  // Period budget: latest upload within the target period.
  let budget_food_sales_period = 0;
  let budget_food_cost_pct = 0;
  let labour_budget_pct = 0;
  const periodUploads = uploads.filter((u) => periodOf(u.week_ending_date) === period);
  if (periodUploads.length > 0) {
    const latestId = periodUploads[periodUploads.length - 1].id;
    budget_food_sales_period = itemFor(latestId, 'Food Sales')?.current_budget || 0;
    budget_food_cost_pct = itemFor(latestId, 'Cost of Sales (Food)')?.current_budget_pct || 0;
    labour_budget_pct = itemFor(latestId, 'Kitchen Labour')?.current_budget_pct || 0;
  }

  // QTD: latest upload per period across the quarter.
  const periodsInQtr = [...new Set(uploads.map((u) => periodOf(u.week_ending_date)).filter(Boolean))] as number[];
  let sage_food_sales_qtd = 0;
  let sage_sales_budget_qtd = 0;
  let foodCostQtdActual = 0;
  let labourQtdActual = 0;
  let foodSalesBudgetQtd = 0;
  let foodCostBudgetQtd = 0;
  let labourBudgetQtd = 0;
  for (const p of periodsInQtr) {
    const pu = uploads.filter((u) => periodOf(u.week_ending_date) === p);
    if (pu.length === 0) continue;
    const latestId = pu[pu.length - 1].id;
    const fs = itemFor(latestId, 'Food Sales');
    const fc = itemFor(latestId, 'Cost of Sales (Food)');
    const lab = itemFor(latestId, 'Kitchen Labour');
    sage_food_sales_qtd += fs?.current_actual || 0;
    sage_sales_budget_qtd += fs?.current_budget || 0;
    foodCostQtdActual += fc?.current_actual || 0;
    labourQtdActual += lab?.current_actual || 0;
    foodSalesBudgetQtd += fs?.current_budget || 0;
    foodCostBudgetQtd += fc?.current_budget || 0;
    labourBudgetQtd += lab?.current_budget || 0;
  }
  const fc_qtd_pct = sage_food_sales_qtd > 0 ? (foodCostQtdActual / sage_food_sales_qtd) * 100 : 0;
  const labour_qtd_pct = sage_food_sales_qtd > 0 ? (labourQtdActual / sage_food_sales_qtd) * 100 : 0;
  const budget_food_cost_qtd_pct = foodSalesBudgetQtd > 0 ? (foodCostBudgetQtd / foodSalesBudgetQtd) * 100 : 0;
  const sage_labour_budget_qtd_pct = foodSalesBudgetQtd > 0 ? (labourBudgetQtd / foodSalesBudgetQtd) * 100 : 0;

  // PTD actuals: this week's own upload.
  let food_cost_ptd_pct = 0;
  let labour_cost_ptd_pct = 0;
  let sales_ptd_actual = 0;
  const calWeek = calWeeks.find((c) => c.period === period && c.week === week);
  const weekUpload = calWeek ? uploads.find((u) => u.week_ending_date === calWeek.end_date) : undefined;
  if (weekUpload) {
    food_cost_ptd_pct = itemFor(weekUpload.id, 'Cost of Sales (Food)')?.current_actual_pct || 0;
    labour_cost_ptd_pct = itemFor(weekUpload.id, 'Kitchen Labour')?.current_actual_pct || 0;
    sales_ptd_actual = itemFor(weekUpload.id, 'Food Sales')?.current_actual || 0;
  }

  return {
    budget_food_sales_period,
    sage_food_sales_qtd,
    sage_sales_budget_qtd,
    budget_food_cost_pct,
    labour_budget_pct,
    fc_qtd_pct,
    food_cost_ptd_pct,
    labour_qtd_pct,
    labour_cost_ptd_pct,
    sales_ptd_actual,
    budget_food_cost_qtd_pct,
    sage_labour_budget_qtd_pct,
  };
}

/**
 * Refresh the stored P&L-driven fields on every saved summary for a location in
 * a given period. Called after a P&L upload so the period budget, QTD and PTD
 * figures stay current without the chef re-saving. Best-effort and per-row, so a
 * single failure doesn't abort the rest. Returns the number of summaries updated.
 */
export async function refreshSummaryPlFieldsForPeriod(
  locationId: string,
  fiscalYear: number,
  period: number
): Promise<number> {
  const { data: summaries } = await supabase
    .from('weekly_chef_summary')
    .select('id, week_number')
    .eq('location_id', locationId)
    .eq('fiscal_year', fiscalYear)
    .eq('period_number', period);
  if (!summaries || summaries.length === 0) return 0;

  let updated = 0;
  for (const s of summaries) {
    const fields = await computePlDrivenSummaryFields(locationId, fiscalYear, period, s.week_number);
    if (!fields) continue;
    const { error } = await supabase
      .from('weekly_chef_summary')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', s.id);
    if (!error) updated++;
  }
  return updated;
}
