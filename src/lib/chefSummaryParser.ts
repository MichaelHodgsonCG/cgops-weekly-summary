export interface ChefSummaryData {
  period_number: number;
  week_number: number;
  location_code: string;

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
  food_sales_labour_push: number;
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

  fc_need_save_per_week: number;
  fc_need_save_per_day: number;
  food_cost_summary: string;
  labour_need_save_per_week: number;
  labour_need_save_per_day: number;
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

  feature_items: Array<{ name: string; sold: number; notes?: string }>;
  hires: string[];
  terminated: string[];
}

function parseNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,\s()]/g, '').replace(/^-/, '');
  const isNegative = value.includes('(') || value.trim().startsWith('-');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : (isNegative ? -num : num);
}

function parsePercentage(value: string): number {
  if (!value) return 0;
  const isNegative = value.includes('(') || value.trim().startsWith('-');
  const cleaned = value.replace(/[%$,\s()]/g, '').replace(/^-/, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : (isNegative ? -num : num);
}

export function parseChefSummaryCSV(csvText: string): ChefSummaryData {
  // Handle both Unix and Windows line endings
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const data: Partial<ChefSummaryData> = {
    feature_items: [],
    hires: [],
    terminated: []
  };

  // Parse CSV line handling quoted fields with commas
  const parseCsvLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const sanitizeText = (text: string): string => {
    return text
      .replace(/\u2018|\u2019|\u0092/g, "'")
      .replace(/\u201C|\u201D/g, '"')
      .replace(/\u2013/g, '-')
      .replace(/\u2014/g, '--')
      .replace(/[\uFFFD\u0080-\u009F]/g, "'");
  };

  const getCell = (line: string, index: number): string => {
    const cells = parseCsvLine(line);
    return sanitizeText(cells[index] || '');
  };

  // Line 1 (index 0): F26,,PERIOD : ,8,WEEK :,2
  data.period_number = parseInt(getCell(lines[0], 3)) || 0;
  data.week_number = parseInt(getCell(lines[0], 5)) || 0;

  // Line 2 (index 1): CULINARY PERFORMANCE SUMMARY ,,,,LOCATION: ,BTB
  data.location_code = getCell(lines[1], 5);

  // Line 4 (index 3): BUDGET FOOD COST%:,24.84%,FOOD COST%:,24.43%, FC VARIANCE:,-0.41%
  data.budget_food_cost_pct = parsePercentage(getCell(lines[3], 1));
  data.actual_food_cost_pct = parsePercentage(getCell(lines[3], 3));
  data.fc_variance = parsePercentage(getCell(lines[3], 5));

  // Line 5 (index 4): THEORETICAL FOOD COST%:,23.99%,ON HAND:,"$15,897.24 ", THEORETICAL VAR:,0.44%
  data.theoretical_food_cost_pct = parsePercentage(getCell(lines[4], 1));
  data.on_hand_amount = parseNumber(getCell(lines[4], 3));
  data.theoretical_variance = parsePercentage(getCell(lines[4], 5));

  // Line 6 (index 5): SAGEFOOD SALES QTD:," $349,673.00 ",SAGE FCOST QTD:,24.62%,FOOD COST PTD%:,24.25%
  data.sage_food_sales_qtd = parseNumber(getCell(lines[5], 1));
  data.sage_fcost_qtd_pct = parsePercentage(getCell(lines[5], 3));
  data.food_cost_ptd_pct = parsePercentage(getCell(lines[5], 5));

  // Line 7 (index 6): SAGE SALES BUDGET QTD:,"$462,843 ",FC QTD%:,24.59%,QTD VARIANCE:,-0.25%
  data.sage_sales_budget_qtd = parseNumber(getCell(lines[6], 1));
  data.fc_qtd_pct = parsePercentage(getCell(lines[6], 3));
  data.qtd_variance_pct = parsePercentage(getCell(lines[6], 5));

  // Line 8 (index 7): USAGE : ,"$17,808.83 ",IDEAL USAGE :,"$17,486 ",COGS QTD:,"-$1,065.97"
  data.usage_amount = parseNumber(getCell(lines[7], 1));
  data.ideal_usage_amount = parseNumber(getCell(lines[7], 3));
  data.cogs_qtd = parseNumber(getCell(lines[7], 5));

  // Line 9 (index 8): FOOD SALES SILVERWARE:,"$72,889 ",FOOD SALES OC:,"$72,843 ",WEEK VARIANCE:,"($4,252)"
  data.food_sales_labour_push = parseNumber(getCell(lines[8], 1));
  data.food_sales_oc = parseNumber(getCell(lines[8], 3));
  data.week_variance_amount = parseNumber(getCell(lines[8], 5));

  // Line 10 (index 9): BUDGET FOOD SALES (PERIOD):,"$308,562 ",WEEK BUGDET :,"$77,141 ",QTD VARIANCE:,"($40,259)"
  data.budget_food_sales_period = parseNumber(getCell(lines[9], 1));
  data.week_budget = parseNumber(getCell(lines[9], 3));
  data.qtd_variance_amount = parseNumber(getCell(lines[9], 5));

  // Line 11 (index 10): LABOUR BUDGET%:,16.85%,LABOUR COST%:,17.18%,LC VARIANCE:,0.33%
  data.labour_budget_pct = parsePercentage(getCell(lines[10], 1));
  data.labour_cost_pct = parsePercentage(getCell(lines[10], 3));
  data.lc_variance = parsePercentage(getCell(lines[10], 5));

  // Line 12 (index 11): SAGE LABOUR BUDGET QTD:,16.98%,SAGE LCOST QTD:,17.41%,LABOUR COST PTD%:,16.99%
  data.sage_labour_budget_qtd_pct = parsePercentage(getCell(lines[11], 1));
  data.sage_lcost_qtd_pct = parsePercentage(getCell(lines[11], 3));
  data.labour_cost_ptd_pct = parsePercentage(getCell(lines[11], 5));

  // Line 13 (index 12): LABOUR QTD%:,17.37%,LAB PTD VAR $ :,"$1,744.37",QTD VARIANCE:,0.41%
  data.labour_qtd_pct = parsePercentage(getCell(lines[12], 1));
  data.lab_ptd_var_amount = parseNumber(getCell(lines[12], 3));
  data.qtd_labour_variance_pct = parsePercentage(getCell(lines[12], 5));

  // Line 14 (index 13): LABOUR $ SPENT :," $12,522.50 ",OVERTIME ,$0.00 ,LAB QTD VAR $,"$1,744.37"
  data.labour_spent = parseNumber(getCell(lines[13], 1));
  data.overtime_amount = parseNumber(getCell(lines[13], 3));
  data.lab_qtd_var_amount = parseNumber(getCell(lines[13], 5));

  // Line 15 (index 14): EBIDTA BUDGET (PERIOD):,12.92%,EBIDTA PTD:,18.26%,VARIANCE:,5.34%
  data.ebidta_budget_period_pct = parsePercentage(getCell(lines[14], 1));
  data.ebidta_ptd_pct = parsePercentage(getCell(lines[14], 3));
  data.ebidta_variance_pct = parsePercentage(getCell(lines[14], 5));

  // Line 16 (index 15): QSR WEEKEND LUNCH TIME:,10:32,QSR  EXPO TIME:,9:36,TEAMSHARE :, $6.47
  data.qsr_weekend_lunch_time = getCell(lines[15], 1);
  data.qsr_expo_time = getCell(lines[15], 3);
  data.teamshare_amount = parseNumber(getCell(lines[15], 5));

  // Line 23 (index 22): PETTY CASH : , $435.31 ,WASTE:, $242.65 ,LAST AUDIT SCORE: ,86.00%
  data.petty_cash = parseNumber(getCell(lines[22], 1));
  data.waste_amount = parseNumber(getCell(lines[22], 3));
  data.last_audit_score_pct = parsePercentage(getCell(lines[22], 5));

  // Line 24 (index 23): BOH PROMO $: , $72.44 ,PROMO $ PTD : , $185.87 ,PROMO $ QTD : , $791.52
  data.boh_promo_amount = parseNumber(getCell(lines[23], 1));
  data.promo_ptd = parseNumber(getCell(lines[23], 3));
  data.promo_qtd = parseNumber(getCell(lines[23], 5));

  // Row 25 (index 24): WEEKS REMAINING IN QTR, 3 ,,,$/WEEK,$/DAY
  data.weeks_remaining_in_qtr = parseInt(getCell(lines[24], 1)) || 0;
  // Row 26 (index 25): FOOD COST SUMMARY (REFERENCE ACTION PLAN >>>,,,,88,13
  data.fc_need_save_per_week = parseNumber(getCell(lines[25], 4));
  data.fc_need_save_per_day = parseNumber(getCell(lines[25], 5));
  // Row 27 (index 26): food cost summary text
  data.food_cost_summary = getCell(lines[26], 0);

  // Row 29 (index 28): E29 = labour need to save per week, F29 = labour need to save per day
  // Also: LABOUR SUMMARY REF QTD $ AMOUNT >>>,,SOUS VAC DAYS :,,291,42
  const sousVacValue = getCell(lines[28], 3);
  data.sous_vac_days = sousVacValue ? parseInt(sousVacValue) : 0;
  data.labour_need_save_per_week = parseNumber(getCell(lines[28], 4));
  data.labour_need_save_per_day = parseNumber(getCell(lines[28], 5));

  // A30 (index 29): Labour summary text
  data.labour_summary = getCell(lines[29], 0);

  // A32 (index 31): BOH PROMO SUMMARY
  data.boh_promo_summary = getCell(lines[31], 0);

  // Line 33-34 (index 32-33): HIRES, TERMINATED
  const hiresLine = lines[33];
  const hireText = getCell(hiresLine, 0);
  data.hires = hireText && hireText !== 'HIRES' ? [hireText] : [];

  const terminatedText = getCell(hiresLine, 1);
  data.terminated = terminatedText && terminatedText !== 'TERMINATED' && terminatedText !== 'None' ? [terminatedText] : [];

  data.notes = '';

  // Line 40 (index 39): Cooks,18,16,2,Still on the hunt for hires...
  data.ideal_cooks = parseInt(getCell(lines[39], 1)) || 0;
  data.current_cooks = parseInt(getCell(lines[39], 2)) || 0;
  data.hiring_notes = getCell(lines[39], 4);

  // Line 41 (index 40): Prep,2,2,0
  data.ideal_prep = parseInt(getCell(lines[40], 1)) || 0;
  data.current_prep = parseInt(getCell(lines[40], 2)) || 0;

  // Line 42 (index 41): Dish,5,5,0
  data.ideal_dish = parseInt(getCell(lines[41], 1)) || 0;
  data.current_dish = parseInt(getCell(lines[41], 2)) || 0;

  // Line 43 (index 42): Other,1,1,0
  data.ideal_other = parseInt(getCell(lines[42], 1)) || 0;
  data.current_other = parseInt(getCell(lines[42], 2)) || 0;

  // A45 (index 44): TM MOTs of Note
  data.tm_mots_of_note = getCell(lines[44], 0);

  // A47 (index 46): Development Path Updates
  data.development_path_updates = getCell(lines[46], 0);

  // A49 (index 48): R&M Issues / Cleaning Focus
  data.rm_issues_cleaning_focus = getCell(lines[48], 0);

  // A51 (index 50): Action Plan Summary
  data.action_plan_summary = getCell(lines[50], 0);

  // Line 52 (index 51): FEATURE ITEM,SOLD:,FEATURE NOTES: (header)
  // Lines 53-55 (index 52-54): Feature items
  const featureItems: Array<{ name: string; sold: number; notes?: string }> = [];
  for (let i = 52; i <= 54 && i < lines.length; i++) {
    const line = lines[i];
    const name = getCell(line, 0);
    const soldText = getCell(line, 1);
    const notes = getCell(line, 2);

    if (name && name.trim() !== '' && name.trim() !== ' ') {
      const sold = parseInt(soldText) || 0;
      featureItems.push({ name: name.trim(), sold, notes: notes || undefined });
    }
  }
  data.feature_items = featureItems;

  return data as ChefSummaryData;
}
