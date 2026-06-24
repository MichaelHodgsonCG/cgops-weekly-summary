import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FeatureItem {
  name: string;
  sold: number;
  notes: string;
}

export interface WeekAheadAction {
  action_text: string;
  owner?: string;
  due_by?: string;
}

export interface FoodCostCategoryRow {
  category: string;
  opening: number;
  glPurchases: number;
  closing: number;
  waste: number;
  actualUsage: number;
  idealUsage: number;
  variance: number;
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
  sales_ptd_actual: number;
  fc_qtd_pct: number;
  qtd_variance_pct: number;
  usage_amount: number;
  ideal_usage_amount: number;
  theoretical_fc_ptd_pct: number;
  theoretical_fc_qtd_pct: number;
  budget_food_cost_qtd_pct: number;
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
  window_time?: string;
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
  sales_action_plan?: string;
  rm_issues_cleaning_focus: string;
  rm_issues?: string;
  cleaning_focus?: string;
  audit_score_comment?: string;
  discount_review_notes?: string;
  speed_of_service_notes?: string;
  overtime_notes?: string;
  labour_review_action_plan?: string;
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
  ai_summary?: string;
}

function pct(val: number) {
  return val ? `${val.toFixed(2)}%` : '0.00%';
}

function currency(val: number) {
  return val
    ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00';
}

function currencyWhole(val: number) {
  return `$${Math.round(val || 0).toLocaleString('en-US')}`;
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
    ['FOOD SALES LABOUR PUSH', currency(data.food_sales_labour_push), 'FOOD SALES OC', currency(data.food_sales_oc), 'WEEK VARIANCE', currency(data.week_variance_amount)],
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

// Colour palette for Tier-1 callouts and gap-flagging.
const COLOR_GREEN: [number, number, number] = [22, 163, 74];
const COLOR_AMBER: [number, number, number] = [217, 119, 6];
const COLOR_RED: [number, number, number] = [220, 38, 38];
const COLOR_SLATE_HEADER: [number, number, number] = [30, 41, 59];

/**
 * Tolerance bands for variance color-coding. Restaurant P&L noise (portioning,
 * timing of invoices, etc.) routinely produces +/-0.5pt swings on FC%/Labour% and
 * the rough equivalent on sales variance without representing a real operational
 * problem, so that's the green/amber boundary. Beyond ~2pt the variance is large
 * enough that it reflects a real trend (not noise) and needs flagging red.
 */
const AMBER_THRESHOLD = 0.5;
const RED_THRESHOLD = 2;

/** Returns an RGB triple for a variance value. `goodIsHigh` = true means higher (more positive) is better. */
function varianceColor(value: number, goodIsHigh: boolean): [number, number, number] {
  const signedBad = goodIsHigh ? -value : value;
  if (signedBad <= AMBER_THRESHOLD) return COLOR_GREEN;
  if (signedBad <= RED_THRESHOLD) return COLOR_AMBER;
  return COLOR_RED;
}

function truncateLines(doc: jsPDF, text: string, maxWidth: number, maxLines: number): string[] {
  if (!text) return [];
  const wrapped: string[] = doc.splitTextToSize(text, maxWidth);
  if (wrapped.length <= maxLines) return wrapped;
  const truncated = wrapped.slice(0, maxLines);
  const last = truncated[maxLines - 1];
  truncated[maxLines - 1] = last.replace(/\s*$/, '') + '…';
  return truncated;
}

function firstNonEmpty(...vals: (string | undefined)[]): string {
  for (const v of vals) {
    if (v && v.trim()) return v.trim();
  }
  return '';
}

function splitIntoBullets(text: string, max: number): string[] {
  if (!text) return [];
  const parts = text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.slice(0, max);
}

export function exportChefSummaryToPdf(
  data: WeeklySummaryData,
  locationName: string,
  weekBudget: number,
  actualFoodCostPct: number,
  fcVariance: number,
  theoreticalFoodCostPct: number,
  _theoreticalVariance: number,
  labourCostPct: number,
  lcVariance: number,
  chefName?: string,
  weekEndingDate?: string,
  recapWtdSalesActual?: number,
  recapWtdSalesBudget?: number,
  recapWtdFcPct?: number,
  recapWtdLabourPct?: number,
  foodCostCategories?: FoodCostCategoryRow[],
  weekAheadActions?: WeekAheadAction[]
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 30;
  const contentWidth = pageWidth - margin * 2;
  const headStyles = { fillColor: COLOR_SLATE_HEADER, textColor: 255, fontStyle: 'bold' as const };

  const wtdSalesActual = recapWtdSalesActual ?? 0;
  const wtdSalesBudget = recapWtdSalesBudget ?? weekBudget;
  const wtdSalesVariancePct = wtdSalesBudget > 0 ? ((wtdSalesActual - wtdSalesBudget) / wtdSalesBudget) * 100 : 0;
  const wtdFcPct = recapWtdFcPct ?? actualFoodCostPct;
  const wtdLabourPct = recapWtdLabourPct ?? labourCostPct;

  const ptdSalesActual = data.sales_ptd_actual;
  const ptdSalesBudget = data.budget_food_sales_period;
  const ptdSalesVariancePct = ptdSalesBudget > 0 ? ((ptdSalesActual - ptdSalesBudget) / ptdSalesBudget) * 100 : 0;
  const qtdSalesActual = data.sage_food_sales_qtd;
  const qtdSalesBudget = data.sage_sales_budget_qtd;
  const qtdSalesVariancePct = qtdSalesBudget > 0 ? ((qtdSalesActual - qtdSalesBudget) / qtdSalesBudget) * 100 : 0;

  // ---------- PAGE 1: RESTAURANT PERFORMANCE ----------

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Culinary Performance Summary', pageWidth / 2, 30, { align: 'center' });

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  const headerLine = `${locationName}   •   Week Ending ${weekEndingDate || '— '}   •   FY${data.fiscal_year} Period ${data.period_number}, Week ${data.week_number}   •   Chef: ${chefName || '________________'}`;
  doc.text(headerLine, pageWidth / 2, 46, { align: 'center' });

  // Tier 1 headline callouts
  const calloutY = 58;
  const calloutH = 64;
  const gap = 10;
  const calloutW = (contentWidth - gap * 2) / 3;

  const drawCallout = (
    x: number,
    label: string,
    value: string,
    subLabel: string,
    color: [number, number, number]
  ) => {
    doc.setFillColor(...color);
    doc.rect(x, calloutY, calloutW, calloutH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), x + calloutW / 2, calloutY + 14, { align: 'center' });
    doc.setFontSize(20);
    doc.text(value, x + calloutW / 2, calloutY + 38, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(subLabel, x + calloutW / 2, calloutY + 54, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  };

  drawCallout(
    margin,
    'Sales Variance',
    `${wtdSalesVariancePct >= 0 ? '+' : ''}${wtdSalesVariancePct.toFixed(1)}%`,
    'vs Budget, WTD',
    varianceColor(wtdSalesVariancePct, true)
  );
  drawCallout(
    margin + calloutW + gap,
    'Food Cost Variance',
    `${fcVariance >= 0 ? '+' : ''}${fcVariance.toFixed(2)}pt`,
    'Actual vs Budget FC%, WTD',
    varianceColor(fcVariance, false)
  );
  drawCallout(
    margin + (calloutW + gap) * 2,
    'Labour Variance',
    `${lcVariance >= 0 ? '+' : ''}${lcVariance.toFixed(2)}pt`,
    'Actual vs Budget %, WTD',
    varianceColor(lcVariance, false)
  );

  let y = calloutY + calloutH + 18;

  // "Why" narrative
  const narrative = firstNonEmpty(
    data.ai_summary,
    [data.food_cost_summary, data.labour_summary, data.action_plan_summary].filter(Boolean).join(' ')
  );
  if (narrative) {
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'italic');
    const wrapped = truncateLines(doc, narrative, contentWidth, 6);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 12 + 16;
  }

  doc.setFont('helvetica', 'normal');

  // Trend tables: Sales / Food Cost / Labour (WTD / PTD / QTD)
  const trendColWidth = (contentWidth - gap * 2) / 3;

  autoTable(doc, {
    startY: y,
    head: [['Sales', 'WTD', 'PTD', 'QTD']],
    body: [
      ['Actual', currencyWhole(wtdSalesActual), currencyWhole(ptdSalesActual), currencyWhole(qtdSalesActual)],
      ['Budget', currencyWhole(wtdSalesBudget), currencyWhole(ptdSalesBudget), currencyWhole(qtdSalesBudget)],
      [
        'Variance %',
        { content: pct(wtdSalesVariancePct), styles: { textColor: varianceColor(wtdSalesVariancePct, true) } },
        { content: pct(ptdSalesVariancePct), styles: { textColor: varianceColor(ptdSalesVariancePct, true) } },
        { content: pct(qtdSalesVariancePct), styles: { textColor: varianceColor(qtdSalesVariancePct, true) } },
      ],
    ],
    styles: { fontSize: 7.5, cellPadding: 3, halign: 'center' },
    headStyles,
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    margin: { left: margin, right: margin + trendColWidth * 2 + gap * 2 },
    tableWidth: trendColWidth,
  });
  const salesTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: y,
    head: [['Food Cost', 'WTD', 'PTD', 'QTD']],
    body: [
      ['Actual %', pct(wtdFcPct), pct(data.food_cost_ptd_pct), pct(data.fc_qtd_pct)],
      ['Theoretical %', pct(theoreticalFoodCostPct), pct(data.theoretical_fc_ptd_pct), pct(data.theoretical_fc_qtd_pct)],
      ['Budget %', pct(data.budget_food_cost_pct), pct(data.budget_food_cost_pct), pct(data.budget_food_cost_qtd_pct)],
      [
        'Gap (Act-Theo)',
        { content: pct(actualFoodCostPct - theoreticalFoodCostPct), styles: { textColor: varianceColor(actualFoodCostPct - theoreticalFoodCostPct, false) } },
        { content: pct(data.food_cost_ptd_pct - data.theoretical_fc_ptd_pct), styles: { textColor: varianceColor(data.food_cost_ptd_pct - data.theoretical_fc_ptd_pct, false) } },
        { content: pct(data.fc_qtd_pct - data.theoretical_fc_qtd_pct), styles: { textColor: varianceColor(data.fc_qtd_pct - data.theoretical_fc_qtd_pct, false) } },
      ],
    ],
    styles: { fontSize: 7.5, cellPadding: 3, halign: 'center' },
    headStyles,
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    margin: { left: margin + trendColWidth + gap, right: margin + trendColWidth + gap },
    tableWidth: trendColWidth,
  });
  const fcTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: y,
    head: [['Labour', 'WTD', 'PTD', 'QTD']],
    body: [
      ['Actual %', pct(wtdLabourPct), pct(data.labour_cost_ptd_pct), pct(data.labour_qtd_pct)],
      ['Budget %', pct(data.labour_budget_pct), pct(data.labour_budget_pct), pct(data.sage_labour_budget_qtd_pct)],
      [
        'Variance %',
        { content: pct(lcVariance), styles: { textColor: varianceColor(lcVariance, false) } },
        { content: pct(data.labour_cost_ptd_pct - data.labour_budget_pct), styles: { textColor: varianceColor(data.labour_cost_ptd_pct - data.labour_budget_pct, false) } },
        { content: pct(data.labour_qtd_pct - data.sage_labour_budget_qtd_pct), styles: { textColor: varianceColor(data.labour_qtd_pct - data.sage_labour_budget_qtd_pct, false) } },
      ],
    ],
    styles: { fontSize: 7.5, cellPadding: 3, halign: 'center' },
    headStyles,
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    margin: { left: margin + (trendColWidth + gap) * 2, right: margin },
    tableWidth: trendColWidth,
  });
  const lcTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  y = Math.max(salesTableY, fcTableY, lcTableY) + 22;

  // Top 3 things that happened this week
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Top 3 Things That Happened This Week', margin, y);
  y += 12;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');

  const weeklyHighlights = [
    ...splitIntoBullets(data.boh_promo_summary, 3),
    ...splitIntoBullets(data.tm_mots_of_note, 3),
  ].slice(0, 3);

  for (let i = 0; i < 3; i++) {
    const bullet = weeklyHighlights[i];
    const line = bullet ? `• ${bullet}` : '• ____________________________________________________';
    const wrapped = doc.splitTextToSize(line, contentWidth);
    doc.text(wrapped.slice(0, 1), margin, y);
    y += 11;
  }

  // COGS / category breakdown
  if (foodCostCategories && foodCostCategories.length > 0) {
    y += 16;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('COGS by Category', margin, y);
    y += 4;

    const totals = foodCostCategories.reduce(
      (acc, c) => ({
        opening: acc.opening + c.opening,
        glPurchases: acc.glPurchases + c.glPurchases,
        closing: acc.closing + c.closing,
        waste: acc.waste + c.waste,
        actualUsage: acc.actualUsage + c.actualUsage,
        idealUsage: acc.idealUsage + c.idealUsage,
        variance: acc.variance + c.variance,
      }),
      { opening: 0, glPurchases: 0, closing: 0, waste: 0, actualUsage: 0, idealUsage: 0, variance: 0 }
    );
    const salesBase = data.food_sales_labour_push || data.food_sales_oc || 0;
    const pctOf = (v: number) => (salesBase > 0 ? ` (${((v / salesBase) * 100).toFixed(2)}%)` : '');

    autoTable(doc, {
      startY: y + 6,
      head: [['Category', 'Opening', 'GL Purchases', 'Closing', 'Waste', 'Actual Usage', 'Ideal Usage', 'Variance']],
      body: [
        ...foodCostCategories.map((c) => [
          c.category,
          currency(c.opening),
          currency(c.glPurchases),
          currency(c.closing),
          `${currency(c.waste)}${pctOf(c.waste)}`,
          `${currency(c.actualUsage)}${pctOf(c.actualUsage)}`,
          `${currency(c.idealUsage)}${pctOf(c.idealUsage)}`,
          `${currency(c.variance)}${pctOf(c.variance)}`,
        ]),
        [
          { content: 'Total', styles: { fontStyle: 'bold' as const } },
          { content: currency(totals.opening), styles: { fontStyle: 'bold' as const } },
          { content: currency(totals.glPurchases), styles: { fontStyle: 'bold' as const } },
          { content: currency(totals.closing), styles: { fontStyle: 'bold' as const } },
          { content: `${currency(totals.waste)}${pctOf(totals.waste)}`, styles: { fontStyle: 'bold' as const } },
          { content: `${currency(totals.actualUsage)}${pctOf(totals.actualUsage)}`, styles: { fontStyle: 'bold' as const } },
          { content: `${currency(totals.idealUsage)}${pctOf(totals.idealUsage)}`, styles: { fontStyle: 'bold' as const } },
          { content: `${currency(totals.variance)}${pctOf(totals.variance)}`, styles: { fontStyle: 'bold' as const } },
        ],
      ],
      styles: { fontSize: 6.5, cellPadding: 2.5, halign: 'center' },
      headStyles: { ...headStyles, fontSize: 6.5 },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, margin, pageHeight - 16);
  doc.setTextColor(0, 0, 0);

  // ---------- PAGE 2: PEOPLE, SERVICE & EXECUTION ----------
  doc.addPage();
  y = margin;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('People, Service & Execution', margin, y);
  y += 16;

  // Staffing & Development table
  const staffRows: { label: string; ideal: number; current: number }[] = [
    { label: 'Cooks', ideal: data.ideal_cooks, current: data.current_cooks },
    { label: 'Prep', ideal: data.ideal_prep, current: data.current_prep },
    { label: 'Dish', ideal: data.ideal_dish, current: data.current_dish },
    { label: 'Other', ideal: data.ideal_other, current: data.current_other },
  ];

  autoTable(doc, {
    startY: y,
    head: [['Role', 'Ideal', 'Current', 'Gap']],
    body: staffRows.map((r) => {
      const gapVal = r.current - r.ideal;
      return [
        r.label,
        String(r.ideal),
        String(r.current),
        { content: gapVal < 0 ? String(gapVal) : `+${gapVal}`, styles: { textColor: gapVal <= -1 ? (gapVal <= -2 ? COLOR_RED : COLOR_AMBER) : COLOR_GREEN } },
      ];
    }),
    styles: { fontSize: 9, cellPadding: 4, halign: 'center' },
    headStyles,
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  if (data.sous_vac_days) {
    y += 8;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100);
    doc.text(`Sous Vac Days this period: ${data.sous_vac_days}`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 18;
  } else {
    y += 10;
  }

  const addShortSection = (title: string, body: string, maxLines = 2) => {
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, y);
    y += 11;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const lines = truncateLines(doc, body || '—', contentWidth, maxLines);
    doc.text(lines, margin, y);
    y += lines.length * 10.5 + 14;
  };

  addShortSection('Hiring Needs', data.hiring_notes);
  addShortSection('Development Path Updates', data.development_path_updates);
  addShortSection('Team Members of Note', data.tm_mots_of_note);

  y += 8;
  doc.setFontSize(11.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Service & Guest Experience', margin, y);
  y += 12;

  autoTable(doc, {
    startY: y,
    head: [['Expo Time', 'Window Time', 'Last Audit Score', 'Audit Comment']],
    body: [[
      data.qsr_expo_time || '—',
      data.window_time || '—',
      pct(data.last_audit_score_pct),
      (data.audit_score_comment || '—').slice(0, 60) + ((data.audit_score_comment || '').length > 60 ? '…' : ''),
    ]],
    styles: { fontSize: 8, cellPadding: 4, halign: 'center' },
    headStyles,
    columnStyles: { 3: { halign: 'left' } },
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;

  if (data.feature_items && data.feature_items.filter((f) => f.name).length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Feature Item', 'Sold', 'Notes']],
      body: data.feature_items
        .filter((f) => f.name)
        .slice(0, 5)
        .map((f) => [f.name, String(f.sold), (f.notes || '').slice(0, 40)]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  } else {
    y += 10;
  }

  // R&M / Cleaning Focus — flags only
  doc.setFontSize(11.5);
  doc.setFont('helvetica', 'bold');
  doc.text('R&M / Cleaning Focus', margin, y);
  y += 12;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const rmFlags = [
    ...splitIntoBullets(data.rm_issues || data.rm_issues_cleaning_focus, 2),
    ...splitIntoBullets(data.cleaning_focus || '', 2),
  ].slice(0, 3);
  if (rmFlags.length === 0) {
    doc.text('• No flags this week.', margin, y);
    y += 11;
  } else {
    for (const flag of rmFlags) {
      const line = doc.splitTextToSize(`• ${flag}`, contentWidth).slice(0, 1);
      doc.text(line, margin, y);
      y += 11;
    }
  }

  y += 16;

  // ACTIONS FOR THE WEEK AHEAD — bordered box.
  // Prefer the chef's explicit, committed actions; fall back to deriving from the
  // action-plan free text only when no structured actions were entered.
  const explicitActions = (weekAheadActions ?? [])
    .filter((a) => a.action_text && a.action_text.trim())
    .slice(0, 6);
  const priorities = explicitActions.length > 0
    ? []
    : [
        ...splitIntoBullets(data.sales_action_plan || data.action_plan_summary, 1),
        ...splitIntoBullets(data.labour_summary, 1),
        ...splitIntoBullets(data.food_cost_summary, 1),
      ].slice(0, 3);

  const boxTop = y;
  const titleLines = ['ACTIONS FOR THE WEEK AHEAD'];
  const titleRowHeight = 22; // room for the 10.5pt bold title baseline + padding before content starts
  let boxContentY = boxTop + titleRowHeight;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const priorityLines = explicitActions.length > 0
    ? explicitActions.map((a) => {
        const meta = [a.owner && a.owner.trim(), a.due_by && a.due_by.trim()]
          .filter(Boolean)
          .join(', ');
        return `• ${a.action_text.trim()}${meta ? `  (${meta})` : ''}`;
      })
    : priorities.length > 0
    ? priorities.map((p) => `• ${p}`)
    : ['• ____________________________________________________'];
  const wrappedPriorityLines = priorityLines.flatMap((l) => doc.splitTextToSize(l, contentWidth - 16));
  const noteLine = '(Full detail in Food Cost Action Plan / Labour Action Plan)';
  const boxHeight = titleRowHeight + wrappedPriorityLines.length * 10.5 + 16;

  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(1);
  doc.rect(margin, boxTop, contentWidth, boxHeight);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(titleLines[0], margin + 8, boxTop + 14);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(wrappedPriorityLines, margin + 8, boxContentY);
  boxContentY += wrappedPriorityLines.length * 10.5 + 2;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100);
  doc.text(noteLine, margin + 8, boxContentY);
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, margin, pageHeight - 16);
  doc.setTextColor(0, 0, 0);

  // ---------- PAGE 3+: FULL NOTES APPENDIX ----------
  // Every notes field, in full, regardless of whether it was already summarized/truncated above.
  const noteSections: { title: string; body?: string }[] = [
    { title: 'Food Cost Summary', body: data.food_cost_summary },
    { title: 'Theoretical / Action Plan Summary', body: data.action_plan_summary },
    { title: 'Sales Action Plan', body: data.sales_action_plan },
    { title: 'Promo Notes', body: data.boh_promo_summary },
    { title: 'Labour Summary', body: data.labour_summary },
    { title: 'Labour Review Action Plan', body: data.labour_review_action_plan },
    { title: 'Overtime Notes', body: data.overtime_notes },
    { title: 'Discount Review Notes', body: data.discount_review_notes },
    { title: 'Speed of Service Notes', body: data.speed_of_service_notes },
    { title: 'Hiring Needs', body: data.hiring_notes },
    { title: 'Team Members of Note', body: data.tm_mots_of_note },
    { title: 'Development Path Updates', body: data.development_path_updates },
    { title: 'R&M Issues', body: data.rm_issues || data.rm_issues_cleaning_focus },
    { title: 'Cleaning Focus', body: data.cleaning_focus },
    { title: 'Audit Score Comment', body: data.audit_score_comment },
    { title: 'General Notes', body: data.notes },
  ].filter((s) => s.body && s.body.trim());

  if (noteSections.length > 0) {
    doc.addPage();
    y = margin;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Full Chef Notes', margin, y);
    y += 8;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100);
    doc.text('Complete, untruncated text for every note field on this report.', margin, y);
    doc.setTextColor(0, 0, 0);
    y += 18;

    for (const section of noteSections) {
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      const titleHeight = 12;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(section.body as string, contentWidth);
      const sectionHeight = titleHeight + lines.length * 10.5 + 14;

      if (y + sectionHeight > pageHeight - margin - 16) {
        doc.addPage();
        y = margin;
      }

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text(section.title, margin, y);
      y += titleHeight;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(lines, margin, y);
      y += lines.length * 10.5 + 14;
    }

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Generated ${new Date().toLocaleDateString()}`, margin, pageHeight - 16);
    doc.setTextColor(0, 0, 0);
  }

  const filename = `ChefSummary_${locationName.replace(/\s+/g, '_')}_FY${data.fiscal_year}_P${data.period_number}_W${data.week_number}.pdf`;
  doc.save(filename);
}
