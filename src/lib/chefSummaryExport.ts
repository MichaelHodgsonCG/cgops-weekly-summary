import * as XLSX from 'xlsx';

interface FeatureItem {
  name: string;
  sold: number;
  notes: string;
}

interface WeeklySummaryData {
  location_id: string;
  week_number: number;
  period_number: number;
  fiscal_year: number;
  budget_food_cost_pct: number;
  on_hand_amount: number;
  sage_food_sales_qtd: number;
  sage_fcost_qtd_pct: number;
  food_cost_ptd_pct: number;
  sage_sales_budget_qtd: number;
  fc_qtd_pct: number;
  qtd_variance_pct: number;
  usage_amount: number;
  ideal_usage_amount: number;
  cogs_qtd: number;
  food_sales_silverware: number;
  food_sales_oc: number;
  week_variance_amount: number;
  budget_food_sales_period: number;
  qtd_variance_amount: number;
  labour_budget_pct: number;
  sage_labour_budget_qtd_pct: number;
  sage_lcost_qtd_pct: number;
  labour_cost_ptd_pct: number;
  labour_qtd_pct: number;
  lab_ptd_var_amount: number;
  qtd_labour_variance_pct: number;
  labour_spent: number;
  overtime_amount: number;
  lab_qtd_var_amount: number;
  ebidta_budget_period_pct: number;
  ebidta_ptd_pct: number;
  ebidta_variance_pct: number;
  qsr_weekend_lunch_time: string;
  qsr_expo_time: string;
  teamshare_amount: number;
  petty_cash: number;
  waste_amount: number;
  last_audit_score_pct: number;
  boh_promo_amount: number;
  promo_ptd: number;
  promo_qtd: number;
  sous_vac_days: number;
  food_cost_summary: string;
  labour_summary: string;
  boh_promo_summary: string;
  notes: string;
  action_plan_summary: string;
  rm_issues_cleaning_focus: string;
  ideal_cooks: number;
  current_cooks: number;
  ideal_prep: number;
  current_prep: number;
  ideal_dish: number;
  current_dish: number;
  ideal_other: number;
  current_other: number;
  hiring_notes: string;
  tm_mots_of_note: string;
  development_path_updates: string;
  feature_items: FeatureItem[];
}

function pct(val: number) {
  return val ? `${val.toFixed(2)}%` : '0.00%';
}

function currency(val: number) {
  return val
    ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00';
}

export function exportChefSummaryToExcel(
  data: WeeklySummaryData,
  locationName: string,
  weekBudget: number,
  actualFoodCostPct: number,
  fcVariance: number,
  theoreticalFoodCostPct: number,
  theoreticalVariance: number,
  labourCostPct: number,
  lcVariance: number
) {
  const wb = XLSX.utils.book_new();

  const rows: (string | number)[][] = [
    [`CULINARY PERFORMANCE SUMMARY`, '', '', '', 'LOCATION:', locationName],
    [`FY${data.fiscal_year}`, '', 'PERIOD:', data.period_number, 'WEEK:', data.week_number],
    [],
    ['FOOD COST'],
    ['BUDGET FOOD COST %', pct(data.budget_food_cost_pct), 'ACTUAL FOOD COST %', pct(actualFoodCostPct), 'FC VARIANCE', pct(fcVariance)],
    ['THEORETICAL FC %', pct(theoreticalFoodCostPct), 'ON HAND', currency(data.on_hand_amount), 'THEORETICAL VAR', pct(theoreticalVariance)],
    ['SAGE FOOD SALES QTD', currency(data.sage_food_sales_qtd), 'SAGE FC QTD %', pct(data.sage_fcost_qtd_pct), 'FOOD COST PTD %', pct(data.food_cost_ptd_pct)],
    ['SAGE SALES BUDGET QTD', currency(data.sage_sales_budget_qtd), 'FC QTD %', pct(data.fc_qtd_pct), 'QTD VARIANCE %', pct(data.qtd_variance_pct)],
    ['USAGE', currency(data.usage_amount), 'IDEAL USAGE', currency(data.ideal_usage_amount), 'COGS QTD', currency(data.cogs_qtd)],
    ['FOOD SALES SILVERWARE', currency(data.food_sales_silverware), 'FOOD SALES OC', currency(data.food_sales_oc), 'WEEK VARIANCE', currency(data.week_variance_amount)],
    ['BUDGET FOOD SALES (PERIOD)', currency(data.budget_food_sales_period), 'WEEK BUDGET', currency(weekBudget), 'QTD VARIANCE $', currency(data.qtd_variance_amount)],
    [],
    ['LABOUR'],
    ['LABOUR BUDGET %', pct(data.labour_budget_pct), 'LABOUR COST %', pct(labourCostPct), 'LC VARIANCE', pct(lcVariance)],
    ['SAGE LABOUR BUDGET QTD %', pct(data.sage_labour_budget_qtd_pct), 'SAGE LC QTD %', pct(data.sage_lcost_qtd_pct), 'LABOUR COST PTD %', pct(data.labour_cost_ptd_pct)],
    ['LABOUR QTD %', pct(data.labour_qtd_pct), 'LAB PTD VAR $', currency(data.lab_ptd_var_amount), 'QTD LABOUR VARIANCE %', pct(data.qtd_labour_variance_pct)],
    ['LABOUR $ SPENT', currency(data.labour_spent), 'OVERTIME', currency(data.overtime_amount), 'LAB QTD VAR $', currency(data.lab_qtd_var_amount)],
    [],
    ['OTHER METRICS'],
    ['EBITDA BUDGET (PERIOD) %', pct(data.ebidta_budget_period_pct), 'EBITDA PTD %', pct(data.ebidta_ptd_pct), 'EBITDA VARIANCE %', pct(data.ebidta_variance_pct)],
    ['QSR WEEKEND LUNCH TIME', data.qsr_weekend_lunch_time, 'QSR EXPO TIME', data.qsr_expo_time, 'TEAMSHARE', currency(data.teamshare_amount)],
    ['PETTY CASH', currency(data.petty_cash), 'WASTE', currency(data.waste_amount), 'LAST AUDIT SCORE', pct(data.last_audit_score_pct)],
    ['BOH PROMO $', currency(data.boh_promo_amount), 'PROMO $ PTD', currency(data.promo_ptd), 'PROMO $ QTD', currency(data.promo_qtd)],
    ['SOUS VAC DAYS', data.sous_vac_days],
    [],
    ['FOOD COST SUMMARY'],
    [data.food_cost_summary],
    [],
    ['LABOUR SUMMARY'],
    [data.labour_summary],
    [],
    ['BOH PROMO SUMMARY'],
    [data.boh_promo_summary],
    [],
    ['TM MOTs OF NOTE'],
    [data.tm_mots_of_note],
    [],
    ['DEVELOPMENT PATH UPDATES'],
    [data.development_path_updates],
    [],
    ['R&M ISSUES / CLEANING FOCUS'],
    [data.rm_issues_cleaning_focus],
    [],
    ['ACTION PLAN SUMMARY'],
    [data.action_plan_summary],
    [],
    ['STAFFING'],
    ['POSITION', 'IDEAL #', 'CURRENT #', 'NEEDED'],
    ['Cooks', data.ideal_cooks, data.current_cooks, Math.max(0, data.ideal_cooks - data.current_cooks)],
    ['Prep', data.ideal_prep, data.current_prep, Math.max(0, data.ideal_prep - data.current_prep)],
    ['Dish', data.ideal_dish, data.current_dish, Math.max(0, data.ideal_dish - data.current_dish)],
    ['Other', data.ideal_other, data.current_other, Math.max(0, data.ideal_other - data.current_other)],
    [],
    ['HIRING NOTES'],
    [data.hiring_notes],
    [],
  ];

  if (data.feature_items && data.feature_items.length > 0) {
    rows.push(['FEATURE ITEMS']);
    rows.push(['FEATURE', 'SOLD', 'NOTES']);
    for (const item of data.feature_items) {
      if (item.name) {
        rows.push([item.name, item.sold, item.notes || '']);
      }
    }
    rows.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 30 },
    { wch: 18 },
    { wch: 30 },
    { wch: 18 },
    { wch: 28 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Chef Summary');

  const filename = `ChefSummary_${locationName.replace(/\s+/g, '_')}_FY${data.fiscal_year}_P${data.period_number}_W${data.week_number}.xlsx`;
  XLSX.writeFile(wb, filename);
}
