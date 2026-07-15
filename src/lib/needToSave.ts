import { supabase } from './supabase';

export type NeedToSaveBasis = 'ytd' | 'qtr' | 'period' | 'none';

export type NeedToSaveResult = {
  fc_need_save_per_week: number;
  fc_need_save_per_day: number;
  fc_basis: NeedToSaveBasis;
  fc_variance_dollars: number;
  fc_weeks_remaining: number;
  labour_need_save_per_week: number;
  labour_need_save_per_day: number;
  labour_basis: NeedToSaveBasis;
  labour_variance_dollars: number;
  labour_weeks_remaining: number;
};

function getQuarterForPeriod(period: number): number {
  if (period <= 3) return 1;
  if (period <= 6) return 2;
  if (period <= 9) return 3;
  return 4;
}

function getPeriodsInQuarter(quarter: number): number[] {
  if (quarter === 1) return [1, 2, 3];
  if (quarter === 2) return [4, 5, 6];
  if (quarter === 3) return [7, 8, 9];
  return [10, 11, 12, 13];
}

export async function getWeeksRemainingInYear(fiscalYear: number, currentPeriod: number, currentWeek: number): Promise<number> {
  const safeWeek = Math.max(1, currentWeek);
  const { data } = await supabase
    .from('fiscal_calendar')
    .select('id, period, week')
    .eq('fiscal_year', fiscalYear)
    .order('period', { ascending: true })
    .order('week', { ascending: true });

  if (!data) return 1;

  return data.filter(w =>
    w.period > currentPeriod || (w.period === currentPeriod && w.week > safeWeek)
  ).length;
}

async function getWeeksRemainingInQuarter(fiscalYear: number, currentPeriod: number, currentWeek: number): Promise<number> {
  const safeWeek = Math.max(1, currentWeek);
  const quarter = getQuarterForPeriod(currentPeriod);
  const qtrPeriods = getPeriodsInQuarter(quarter);

  const { data } = await supabase
    .from('fiscal_calendar')
    .select('id, period, week')
    .eq('fiscal_year', fiscalYear)
    .in('period', qtrPeriods)
    .order('period', { ascending: true })
    .order('week', { ascending: true });

  if (!data) return 1;

  return data.filter(w =>
    w.period > currentPeriod || (w.period === currentPeriod && w.week > safeWeek)
  ).length;
}

async function getWeeksRemainingInPeriod(fiscalYear: number, currentPeriod: number, currentWeek: number): Promise<number> {
  const safeWeek = Math.max(1, currentWeek);
  const { data } = await supabase
    .from('fiscal_calendar')
    .select('id, week')
    .eq('fiscal_year', fiscalYear)
    .eq('period', currentPeriod)
    .order('week', { ascending: true });

  if (!data) return 1;

  return data.filter(w => w.week > safeWeek).length;
}

function calcVarianceDollars(
  actualPct: number | null,
  budgetPct: number | null,
  sales: number | null
): number | null {
  if (actualPct === null || budgetPct === null || !sales || sales === 0) return null;
  return ((actualPct - budgetPct) / 100) * sales;
}

export async function calculateNeedToSave(
  locationId: string,
  fiscalYear: number,
  periodNumber: number,
  weekNumber: number
): Promise<NeedToSaveResult | null> {
  const mostRecentWeek = await getMostRecentPLWeek(locationId, fiscalYear, periodNumber);
  if (!mostRecentWeek) return null;

  const lineItems = mostRecentWeek.lineItems;

  const foodSales = lineItems.find(i => i.line_item_name === 'Food Sales');
  const foodCost = lineItems.find(i => i.line_item_name === 'Cost of Sales (Food)');
  const labour = lineItems.find(i => i.line_item_name === 'Kitchen Labour');

  if (!foodSales) return null;

  const ytdFoodSales = foodSales.ytd_actual ?? 0;
  const periodFoodSales = foodSales.current_actual ?? 0;
  const qtdFoodSales = foodSales.qtd_actual ?? 0;

  const ytdFoodCostVariance = calcVarianceDollars(
    foodCost?.ytd_actual_pct ?? null,
    foodCost?.ytd_budget_pct ?? null,
    ytdFoodSales
  );
  const qtdFoodCostVariance = calcVarianceDollars(
    foodCost?.qtd_actual_pct ?? null,
    foodCost?.qtd_budget_pct ?? null,
    qtdFoodSales
  );
  const periodFoodCostVariance = calcVarianceDollars(
    foodCost?.current_actual_pct ?? null,
    foodCost?.current_budget_pct ?? null,
    periodFoodSales
  );

  const ytdLabourVariance = calcVarianceDollars(
    labour?.ytd_actual_pct ?? null,
    labour?.ytd_budget_pct ?? null,
    ytdFoodSales
  );
  const qtdLabourVariance = calcVarianceDollars(
    labour?.qtd_actual_pct ?? null,
    labour?.qtd_budget_pct ?? null,
    qtdFoodSales
  );
  const periodLabourVariance = calcVarianceDollars(
    labour?.current_actual_pct ?? null,
    labour?.current_budget_pct ?? null,
    periodFoodSales
  );

  const [weeksInYear, weeksInQtr, weeksInPeriod] = await Promise.all([
    getWeeksRemainingInYear(fiscalYear, periodNumber, weekNumber),
    getWeeksRemainingInQuarter(fiscalYear, periodNumber, weekNumber),
    getWeeksRemainingInPeriod(fiscalYear, periodNumber, weekNumber),
  ]);

  const fcResult = resolveNeedToSave(
    ytdFoodCostVariance,
    qtdFoodCostVariance,
    periodFoodCostVariance,
    weeksInYear,
    weeksInQtr,
    weeksInPeriod
  );

  const labourResult = resolveNeedToSave(
    ytdLabourVariance,
    qtdLabourVariance,
    periodLabourVariance,
    weeksInYear,
    weeksInQtr,
    weeksInPeriod
  );

  return {
    fc_need_save_per_week: fcResult.perWeek,
    fc_need_save_per_day: fcResult.perDay,
    fc_basis: fcResult.basis,
    fc_variance_dollars: fcResult.varianceDollars,
    fc_weeks_remaining: fcResult.weeksRemaining,
    labour_need_save_per_week: labourResult.perWeek,
    labour_need_save_per_day: labourResult.perDay,
    labour_basis: labourResult.basis,
    labour_variance_dollars: labourResult.varianceDollars,
    labour_weeks_remaining: labourResult.weeksRemaining,
  };
}

function resolveNeedToSave(
  ytdVar: number | null,
  qtdVar: number | null,
  periodVar: number | null,
  weeksInYear: number,
  weeksInQtr: number,
  weeksInPeriod: number
): { perWeek: number; perDay: number; basis: NeedToSaveBasis; varianceDollars: number; weeksRemaining: number } {
  const safeWeeks = (n: number) => Math.max(n, 1);

  if (ytdVar !== null && ytdVar > 0) {
    const weeks = safeWeeks(weeksInYear);
    const perWeek = ytdVar / weeks;
    return { perWeek, perDay: perWeek / 7, basis: 'ytd', varianceDollars: ytdVar, weeksRemaining: weeks };
  }

  if (qtdVar !== null && qtdVar > 0) {
    const weeks = safeWeeks(weeksInQtr);
    const perWeek = qtdVar / weeks;
    return { perWeek, perDay: perWeek / 7, basis: 'qtr', varianceDollars: qtdVar, weeksRemaining: weeks };
  }

  if (periodVar !== null && periodVar > 0) {
    const weeks = safeWeeks(weeksInPeriod);
    const perWeek = periodVar / weeks;
    return { perWeek, perDay: perWeek / 7, basis: 'period', varianceDollars: periodVar, weeksRemaining: weeks };
  }

  return { perWeek: 0, perDay: 0, basis: 'none', varianceDollars: 0, weeksRemaining: 0 };
}

type LineItemRow = {
  line_item_name: string;
  current_actual: number | null;
  current_actual_pct: number | null;
  current_budget: number | null;
  current_budget_pct: number | null;
  ytd_actual: number | null;
  ytd_actual_pct: number | null;
  ytd_budget: number | null;
  ytd_budget_pct: number | null;
  qtd_actual: number | null;
  qtd_actual_pct: number | null;
  qtd_budget: number | null;
  qtd_budget_pct: number | null;
};

async function getMostRecentPLWeek(
  locationId: string,
  fiscalYear: number,
  periodNumber: number
): Promise<{ lineItems: LineItemRow[] } | null> {
  const { data: uploads } = await supabase
    .from('weekly_summary_pl_uploads')
    .select('id, week_ending_date')
    .eq('location_id', locationId)
    .order('week_ending_date', { ascending: false })
    .limit(1);

  if (!uploads || uploads.length === 0) return null;

  const uploadId = uploads[0].id;

  const { data: items } = await supabase
    .from('weekly_summary_pl_line_items')
    .select(
      'line_item_name, current_actual, current_actual_pct, current_budget, current_budget_pct, ytd_actual, ytd_actual_pct, ytd_budget, ytd_budget_pct, qtd_actual, qtd_actual_pct, qtd_budget, qtd_budget_pct'
    )
    .eq('upload_id', uploadId)
    .in('line_item_name', ['Food Sales', 'Cost of Sales (Food)', 'Kitchen Labour']);

  if (!items) return null;

  return { lineItems: items };
}

export type LabourPlBaseline = {
  weekEndingDate: string;
  isCurrentWeek: boolean;
  periodSalesActual: number;
  periodLabourActual: number;
  periodBudgetPct: number;
  ytdSalesActual: number;
  ytdLabourActual: number;
  ytdBudgetPct: number;
};

export async function fetchLabourPlBaseline(
  locationId: string,
  fiscalYear: number,
  periodNumber: number,
  weekNumber: number
): Promise<LabourPlBaseline | null> {
  const { data: uploads } = await supabase
    .from('weekly_summary_pl_uploads')
    .select('id, week_ending_date')
    .eq('location_id', locationId)
    .order('week_ending_date', { ascending: false })
    .limit(1);

  if (!uploads || uploads.length === 0) return null;

  const upload = uploads[0];

  const { data: items } = await supabase
    .from('weekly_summary_pl_line_items')
    .select('line_item_name, current_actual, current_budget_pct, ytd_actual, ytd_budget_pct')
    .eq('upload_id', upload.id)
    .in('line_item_name', ['Food Sales', 'Kitchen Labour']);

  if (!items) return null;

  const sales = items.find(i => i.line_item_name === 'Food Sales');
  const labour = items.find(i => i.line_item_name === 'Kitchen Labour');

  const { data: calWeek } = await supabase
    .from('fiscal_calendar')
    .select('end_date')
    .eq('fiscal_year', fiscalYear)
    .eq('period', periodNumber)
    .eq('week', weekNumber)
    .maybeSingle();

  return {
    weekEndingDate: upload.week_ending_date,
    isCurrentWeek: !!calWeek && calWeek.end_date === upload.week_ending_date,
    periodSalesActual: sales?.current_actual ?? 0,
    periodLabourActual: labour?.current_actual ?? 0,
    periodBudgetPct: labour?.current_budget_pct ?? 0,
    ytdSalesActual: sales?.ytd_actual ?? 0,
    ytdLabourActual: labour?.ytd_actual ?? 0,
    ytdBudgetPct: labour?.ytd_budget_pct ?? 0,
  };
}

export type FoodCostPlBaseline = {
  weekEndingDate: string;
  isCurrentWeek: boolean;
  periodSalesActual: number;
  periodFoodCostActual: number;
  periodBudgetPct: number;
  ytdSalesActual: number;
  ytdFoodCostActual: number;
  ytdBudgetPct: number;
};

export async function fetchFoodCostPlBaseline(
  locationId: string,
  fiscalYear: number,
  periodNumber: number,
  weekNumber: number
): Promise<FoodCostPlBaseline | null> {
  const { data: uploads } = await supabase
    .from('weekly_summary_pl_uploads')
    .select('id, week_ending_date')
    .eq('location_id', locationId)
    .order('week_ending_date', { ascending: false })
    .limit(1);

  if (!uploads || uploads.length === 0) return null;

  const upload = uploads[0];

  const { data: items } = await supabase
    .from('weekly_summary_pl_line_items')
    .select('line_item_name, current_actual, current_budget_pct, ytd_actual, ytd_budget_pct')
    .eq('upload_id', upload.id)
    .in('line_item_name', ['Food Sales', 'Cost of Sales (Food)']);

  if (!items) return null;

  const sales = items.find(i => i.line_item_name === 'Food Sales');
  const foodCost = items.find(i => i.line_item_name === 'Cost of Sales (Food)');

  const { data: calWeek } = await supabase
    .from('fiscal_calendar')
    .select('end_date')
    .eq('fiscal_year', fiscalYear)
    .eq('period', periodNumber)
    .eq('week', weekNumber)
    .maybeSingle();

  return {
    weekEndingDate: upload.week_ending_date,
    isCurrentWeek: !!calWeek && calWeek.end_date === upload.week_ending_date,
    periodSalesActual: sales?.current_actual ?? 0,
    periodFoodCostActual: foodCost?.current_actual ?? 0,
    periodBudgetPct: foodCost?.current_budget_pct ?? 0,
    ytdSalesActual: sales?.ytd_actual ?? 0,
    ytdFoodCostActual: foodCost?.ytd_actual ?? 0,
    ytdBudgetPct: foodCost?.ytd_budget_pct ?? 0,
  };
}

export type SalesPlBaseline = {
  weekEndingDate: string;
  isCurrentWeek: boolean;
  periodSalesActual: number;
  periodSalesBudget: number;
  ytdSalesActual: number;
  ytdSalesBudget: number;
};

export async function fetchSalesPlBaseline(
  locationId: string,
  fiscalYear: number,
  periodNumber: number,
  weekNumber: number
): Promise<SalesPlBaseline | null> {
  const { data: uploads } = await supabase
    .from('weekly_summary_pl_uploads')
    .select('id, week_ending_date')
    .eq('location_id', locationId)
    .order('week_ending_date', { ascending: false })
    .limit(1);

  if (!uploads || uploads.length === 0) return null;

  const upload = uploads[0];

  const { data: items } = await supabase
    .from('weekly_summary_pl_line_items')
    .select('line_item_name, current_actual, current_budget, ytd_actual, ytd_budget')
    .eq('upload_id', upload.id)
    .eq('line_item_name', 'Food Sales');

  if (!items) return null;

  const sales = items.find(i => i.line_item_name === 'Food Sales');

  const { data: calWeek } = await supabase
    .from('fiscal_calendar')
    .select('end_date')
    .eq('fiscal_year', fiscalYear)
    .eq('period', periodNumber)
    .eq('week', weekNumber)
    .maybeSingle();

  return {
    weekEndingDate: upload.week_ending_date,
    isCurrentWeek: !!calWeek && calWeek.end_date === upload.week_ending_date,
    periodSalesActual: sales?.current_actual ?? 0,
    periodSalesBudget: sales?.current_budget ?? 0,
    ytdSalesActual: sales?.ytd_actual ?? 0,
    ytdSalesBudget: sales?.ytd_budget ?? 0,
  };
}

export async function computeQtdForUpload(
  locationId: string,
  fiscalYear: number,
  currentPeriod: number,
  currentWeekEndingDate: string,
  lineItems: { line_item_name: string; current_actual: number | null; current_actual_pct: number | null; current_budget: number | null; current_budget_pct: number | null }[]
): Promise<Map<string, { qtd_actual: number | null; qtd_actual_pct: number | null; qtd_budget: number | null; qtd_budget_pct: number | null }>> {
  const quarter = getQuarterForPeriod(currentPeriod);
  const qtrPeriods = getPeriodsInQuarter(quarter);
  const priorQtrPeriods = qtrPeriods.filter(p => p < currentPeriod);

  const result = new Map<string, { qtd_actual: number | null; qtd_actual_pct: number | null; qtd_budget: number | null; qtd_budget_pct: number | null }>();

  const lineItemNames = lineItems.map(i => i.line_item_name);

  let priorPeriodItems: { line_item_name: string; current_actual: number | null; current_budget: number | null; ytd_actual: number | null; ytd_budget: number | null }[] = [];

  if (priorQtrPeriods.length > 0) {
    const { data: calWeeks } = await supabase
      .from('fiscal_calendar')
      .select('end_date, period')
      .eq('fiscal_year', fiscalYear)
      .in('period', priorQtrPeriods)
      .order('end_date', { ascending: false })
      .limit(1);

    if (calWeeks && calWeeks.length > 0) {
      const lastPriorPeriodEndDate = calWeeks[0].end_date;

      const { data: uploads } = await supabase
        .from('weekly_summary_pl_uploads')
        .select('id')
        .eq('location_id', locationId)
        .eq('week_ending_date', lastPriorPeriodEndDate)
        .limit(1);

      if (uploads && uploads.length > 0) {
        const { data: items } = await supabase
          .from('weekly_summary_pl_line_items')
          .select('line_item_name, current_actual, current_budget, ytd_actual, ytd_budget')
          .eq('upload_id', uploads[0].id)
          .in('line_item_name', lineItemNames);

        if (items) {
          priorPeriodItems = items;
        }
      }
    }
  }

  for (const item of lineItems) {
    const priorItem = priorPeriodItems.find(p => p.line_item_name === item.line_item_name);

    const priorQtdActual = priorItem?.current_actual ?? 0;
    const priorQtdBudget = priorItem?.current_budget ?? 0;
    const currentActual = item.current_actual ?? 0;
    const currentBudget = item.current_budget ?? 0;

    const qtd_actual = priorQtdActual + currentActual;
    const qtd_budget = priorQtdBudget + currentBudget;

    const foodSalesItem = lineItems.find(i => i.line_item_name === 'Food Sales');
    const priorFoodSales = priorPeriodItems.find(p => p.line_item_name === 'Food Sales');
    const qtdFoodSales = (priorFoodSales?.current_actual ?? 0) + (foodSalesItem?.current_actual ?? 0);

    const qtd_actual_pct = qtdFoodSales > 0 ? (qtd_actual / qtdFoodSales) * 100 : null;
    const qtd_budget_pct = qtdFoodSales > 0 ? (qtd_budget / qtdFoodSales) * 100 : null;

    result.set(item.line_item_name, { qtd_actual, qtd_actual_pct, qtd_budget, qtd_budget_pct });
  }

  return result;
}
