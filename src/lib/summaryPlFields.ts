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
 * This week's chef-entered actuals (Push sales, recomputed food usage, and
 * post-transfer labour). When this week's own Sage P&L has not been uploaded
 * yet, PTD is estimated as "prior weeks' Sage period-to-date + this week's
 * chef actuals" so ops gets a live PTD Monday night without waiting for
 * accounting. Once this week's P&L lands, the reconciled Sage figure takes
 * over automatically (see computePlDrivenSummaryFields).
 */
export type ChefWeekActuals = {
  salesPush: number;
  usageAmount: number;
  labourSpent: number;
};

/**
 * Compute the P&L-driven summary fields for one location/week from the current
 * P&L data. Mirrors the logic the chef-summary save uses (fetchPLDataForPeriod +
 * fetchPTDFromPL): period budget from the latest upload in the period, QTD from
 * the latest upload per period across the quarter, and PTD actuals from this
 * specific week's upload.
 *
 * PTD sourcing (Sage-uploaded = truth; chef estimate fills the gap):
 *   - If this week's own P&L upload exists, PTD comes straight from it
 *     (reconciled Sage — the truth).
 *   - Otherwise, when chefActuals are supplied, PTD is estimated as the latest
 *     prior-week P&L period-to-date plus this week's chef actuals, so the
 *     Monday report isn't blank while accounting catches up. It flips to Sage
 *     automatically the moment this week's P&L is uploaded.
 *
 * Returns null when there's no P&L for the quarter yet.
 */
export async function computePlDrivenSummaryFields(
  locationId: string,
  fiscalYear: number,
  period: number,
  week: number,
  chefActuals?: ChefWeekActuals
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
    .from('weekly_summary_pl_uploads')
    .select('id, week_ending_date')
    .eq('location_id', locationId)
    .in('week_ending_date', quarterEndDates)
    .order('week_ending_date', { ascending: true });
  if (!uploads || uploads.length === 0) return null;

  const uploadIds = uploads.map((u) => u.id);
  const { data: lineItems } = await supabase
    .from('weekly_summary_pl_line_items')
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

  // PTD actuals. Prefer this week's own reconciled Sage upload; otherwise
  // estimate from the latest prior-week P&L plus this week's chef actuals.
  let food_cost_ptd_pct = 0;
  let labour_cost_ptd_pct = 0;
  let sales_ptd_actual = 0;
  const calWeek = calWeeks.find((c) => c.period === period && c.week === week);
  const weekUpload = calWeek ? uploads.find((u) => u.week_ending_date === calWeek.end_date) : undefined;
  if (weekUpload) {
    // Reconciled Sage for this week exists — it is the truth.
    food_cost_ptd_pct = itemFor(weekUpload.id, 'Cost of Sales (Food)')?.current_actual_pct || 0;
    labour_cost_ptd_pct = itemFor(weekUpload.id, 'Kitchen Labour')?.current_actual_pct || 0;
    sales_ptd_actual = itemFor(weekUpload.id, 'Food Sales')?.current_actual || 0;
  } else if (chefActuals) {
    // No P&L for this week yet — estimate PTD so the Monday report isn't blank.
    // periodUploads are all prior weeks here (this week's upload is absent), so
    // the latest one carries period-to-date actuals through last week.
    const weekEndOf = calWeek?.end_date;
    const priorInPeriod = periodUploads.filter((u) => !weekEndOf || u.week_ending_date < weekEndOf);
    let priorSales = 0;
    let priorFoodCost = 0;
    let priorLabour = 0;
    if (priorInPeriod.length > 0) {
      const latestPriorId = priorInPeriod[priorInPeriod.length - 1].id;
      priorSales = itemFor(latestPriorId, 'Food Sales')?.current_actual || 0;
      priorFoodCost = itemFor(latestPriorId, 'Cost of Sales (Food)')?.current_actual || 0;
      priorLabour = itemFor(latestPriorId, 'Kitchen Labour')?.current_actual || 0;
    }
    const ptdSales = priorSales + chefActuals.salesPush;
    const ptdFoodCost = priorFoodCost + chefActuals.usageAmount;
    const ptdLabour = priorLabour + chefActuals.labourSpent;
    sales_ptd_actual = ptdSales;
    food_cost_ptd_pct = ptdSales > 0 ? (ptdFoodCost / ptdSales) * 100 : 0;
    labour_cost_ptd_pct = ptdSales > 0 ? (ptdLabour / ptdSales) * 100 : 0;
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

export type TrueUpLine = {
  metric: 'Sales' | 'COGs' | 'Labour';
  estimate: number;
  sage: number;
  variance: number; // estimate - sage (positive = chef estimate was higher)
  estimatePct: number | null; // % of that side's sales; null for the Sales row
  sagePct: number | null;
};

export type LocationTrueUp = {
  locationId: string;
  locationName: string;
  weekEndingDate: string;
  weekNumber: number;
  period: number;
  salesIsPushBasis: boolean; // Sales compares Push (chef) vs Sage — different bases
  lines: TrueUpLine[];
};

/**
 * Compare the chef's estimate for a week against the reconciled Sage figures
 * just uploaded, for Sales / COGs / Labour. Used to show a per-location
 * true-up variance right after a Sage P&L upload.
 *
 * The Sage weekly value is derived as this week's period-to-date actual minus
 * the prior week's (P&L current_actual is cumulative within the period). The
 * chef estimate is the saved weekly summary (Push sales, recomputed usage,
 * post-transfer labour). Sales necessarily compares Push vs Sage — different
 * source systems — so that row is flagged.
 *
 * Returns null when there's no chef summary for the week (nothing to true up)
 * or the week's own upload can't be found.
 */
export async function computeSageTrueUpVariance(
  locationId: string,
  locationName: string,
  fiscalYear: number,
  period: number,
  weekEndingDate: string
): Promise<LocationTrueUp | null> {
  const { data: cal } = await supabase
    .from('fiscal_calendar')
    .select('week, end_date')
    .eq('fiscal_year', fiscalYear)
    .eq('period', period)
    .order('week', { ascending: true });
  if (!cal || cal.length === 0) return null;

  const thisCal = cal.find((c) => c.end_date === weekEndingDate);
  if (!thisCal) return null;
  const weekNumber = thisCal.week;

  const { data: summary } = await supabase
    .from('weekly_summary_chef_summary')
    .select('food_sales_labour_push, usage_amount, labour_spent')
    .eq('location_id', locationId)
    .eq('fiscal_year', fiscalYear)
    .eq('period_number', period)
    .eq('week_number', weekNumber)
    .maybeSingle();
  if (!summary) return null;

  const periodEndDates = cal.filter((c) => c.end_date <= weekEndingDate).map((c) => c.end_date);
  const { data: uploads } = await supabase
    .from('weekly_summary_pl_uploads')
    .select('id, week_ending_date')
    .eq('location_id', locationId)
    .in('week_ending_date', periodEndDates)
    .order('week_ending_date', { ascending: true });
  if (!uploads || uploads.length === 0) return null;

  const thisUpload = uploads.find((u) => u.week_ending_date === weekEndingDate);
  if (!thisUpload) return null;
  const priorUploads = uploads.filter((u) => u.week_ending_date < weekEndingDate);
  const priorUpload = priorUploads.length ? priorUploads[priorUploads.length - 1] : null;

  const ids = [thisUpload.id, ...(priorUpload ? [priorUpload.id] : [])];
  const { data: items } = await supabase
    .from('weekly_summary_pl_line_items')
    .select('upload_id, line_item_name, current_actual')
    .in('upload_id', ids)
    .in('line_item_name', ['Food Sales', 'Cost of Sales (Food)', 'Kitchen Labour']);

  const val = (uploadId: string, name: string) =>
    items?.find((i) => i.upload_id === uploadId && i.line_item_name === name)?.current_actual || 0;
  const sageWeek = (name: string) => val(thisUpload.id, name) - (priorUpload ? val(priorUpload.id, name) : 0);

  const sageSales = sageWeek('Food Sales');
  const sageCogs = sageWeek('Cost of Sales (Food)');
  const sageLabour = sageWeek('Kitchen Labour');

  const estSales = summary.food_sales_labour_push || 0;
  const estCogs = summary.usage_amount || 0;
  const estLabour = summary.labour_spent || 0;

  const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null);

  return {
    locationId,
    locationName,
    weekEndingDate,
    weekNumber,
    period,
    salesIsPushBasis: true,
    lines: [
      { metric: 'Sales', estimate: estSales, sage: sageSales, variance: estSales - sageSales, estimatePct: null, sagePct: null },
      { metric: 'COGs', estimate: estCogs, sage: sageCogs, variance: estCogs - sageCogs, estimatePct: pct(estCogs, estSales), sagePct: pct(sageCogs, sageSales) },
      { metric: 'Labour', estimate: estLabour, sage: sageLabour, variance: estLabour - sageLabour, estimatePct: pct(estLabour, estSales), sagePct: pct(sageLabour, sageSales) },
    ],
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
    .from('weekly_summary_chef_summary')
    .select('id, week_number, food_sales_labour_push, usage_amount, labour_spent')
    .eq('location_id', locationId)
    .eq('fiscal_year', fiscalYear)
    .eq('period_number', period);
  if (!summaries || summaries.length === 0) return 0;

  let updated = 0;
  for (const s of summaries) {
    // Pass this week's saved chef actuals so PTD still estimates correctly for
    // weeks whose own Sage upload isn't in yet; weeks that do have a P&L ignore
    // these and use the reconciled Sage figure.
    const fields = await computePlDrivenSummaryFields(locationId, fiscalYear, period, s.week_number, {
      salesPush: s.food_sales_labour_push || 0,
      usageAmount: s.usage_amount || 0,
      labourSpent: s.labour_spent || 0,
    });
    if (!fields) continue;
    const { error } = await supabase
      .from('weekly_summary_chef_summary')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', s.id);
    if (!error) updated++;
  }
  return updated;
}
