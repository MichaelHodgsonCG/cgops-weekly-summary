import { useEffect, useState } from 'react';
import { ClipboardCheck, Upload, CheckCircle2, AlertCircle, X, Plus, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { fetchLabourPlBaseline, fetchSalesPlBaseline, getWeeksRemainingInYear, LabourPlBaseline, SalesPlBaseline } from '../lib/needToSave';

type GuidedStep = 'start' | 'sales' | 'transfers' | 'overtime' | 'review' | 'discounts' | 'speedOfService' | 'salesRecap';

type StepMeta = {
  section: number;
  sectionLabel: string;
  sectionStepIndex: number;
  sectionStepCount: number;
  overallIndex: number;
  stepLabel: string;
};

const STEP_META: Record<Exclude<GuidedStep, 'start'>, StepMeta> = {
  sales: {
    section: 1,
    sectionLabel: 'Sales and Labour',
    sectionStepIndex: 1,
    sectionStepCount: 4,
    overallIndex: 1,
    stepLabel: 'Budget and Sales Upload',
  },
  transfers: {
    section: 1,
    sectionLabel: 'Sales and Labour',
    sectionStepIndex: 2,
    sectionStepCount: 4,
    overallIndex: 2,
    stepLabel: 'Labour Transfers',
  },
  overtime: {
    section: 1,
    sectionLabel: 'Sales and Labour',
    sectionStepIndex: 3,
    sectionStepCount: 4,
    overallIndex: 3,
    stepLabel: 'Overtime',
  },
  review: {
    section: 1,
    sectionLabel: 'Sales and Labour',
    sectionStepIndex: 4,
    sectionStepCount: 4,
    overallIndex: 4,
    stepLabel: 'Sales and Labour Review',
  },
  discounts: {
    section: 2,
    sectionLabel: 'Discounts',
    sectionStepIndex: 1,
    sectionStepCount: 1,
    overallIndex: 5,
    stepLabel: 'Discounts',
  },
  speedOfService: {
    section: 3,
    sectionLabel: 'Speed of Service',
    sectionStepIndex: 1,
    sectionStepCount: 1,
    overallIndex: 6,
    stepLabel: 'Speed of Service',
  },
  salesRecap: {
    section: 4,
    sectionLabel: 'Sales & Execution Recap',
    sectionStepIndex: 1,
    sectionStepCount: 1,
    overallIndex: 7,
    stepLabel: 'Sales & Execution Recap',
  },
};

const TOTAL_STEPS = Object.keys(STEP_META).length;

type ProfitCenterParseResult = {
  salesDaily: number[];
  salesTotal: number;
  labourDaily: number[];
  labourTotal: number;
  overtimeDaily: number[];
  overtimeTotal: number;
  doubletimeDaily: number[];
  doubletimeTotal: number;
};

const DISCOUNT_REASON_CATEGORIES = [
  { label: 'Guest Did Not Like', match: 'guest did not like s' },
  { label: 'Quality Issue', match: 'quality issue s' },
  { label: 'Slow', match: 'slow s' },
  { label: 'Steak Over/Under', match: 'steak over under s' },
];

type DiscountItem = {
  itemDesc: string;
  count: number;
  amount: number;
};

type DiscountCategoryResult = {
  label: string;
  dailyCounts: number[];
  dailyAmounts: number[];
  totalCount: number;
  totalAmount: number;
  items: DiscountItem[];
};

type DiscountsParseResult = {
  days: number[];
  categories: DiscountCategoryResult[];
};

type TransferDestination = 'vacation' | 'management' | 'other';

const TRANSFER_DESTINATIONS: { value: TransferDestination; label: string }[] = [
  { value: 'vacation', label: 'Transfer to Vacation' },
  { value: 'management', label: 'Transfer to Management Labour' },
  { value: 'other', label: 'Transfer to Other' },
];

type TransferEntry = {
  id: string;
  annualWage: string;
  days: string;
  destination: TransferDestination;
  reason: string;
};

function normalizeDiscountReason(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

function findRow(rows: any[][], label: string): any[] | undefined {
  return rows.find((row) => String(row[0] ?? '').trim() === label);
}

function parseProfitCenterReport(buffer: ArrayBuffer): ProfitCenterParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets['BOH'];

  if (!sheet) {
    throw new Error('Could not find a "BOH" sheet in this report.');
  }

  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const salesRow = findRow(rows, 'Sales Total');
  const labourRow = findRow(rows, 'Labor Total');
  const overtimeRow = findRow(rows, 'Overtime');
  const doubletimeRow = findRow(rows, 'Doubletime');

  if (!salesRow || !labourRow) {
    throw new Error('Could not find "Sales Total" or "Labor Total" rows on the BOH sheet.');
  }

  const toNumbers = (row: any[]) =>
    row.slice(1, 8).map((v) => parseFloat(String(v ?? 0)) || 0);

  return {
    salesDaily: toNumbers(salesRow),
    salesTotal: parseFloat(String(salesRow[8] ?? 0)) || 0,
    labourDaily: toNumbers(labourRow),
    labourTotal: parseFloat(String(labourRow[8] ?? 0)) || 0,
    overtimeDaily: overtimeRow ? toNumbers(overtimeRow) : [0, 0, 0, 0, 0, 0, 0],
    overtimeTotal: overtimeRow ? parseFloat(String(overtimeRow[8] ?? 0)) || 0 : 0,
    doubletimeDaily: doubletimeRow ? toNumbers(doubletimeRow) : [0, 0, 0, 0, 0, 0, 0],
    doubletimeTotal: doubletimeRow ? parseFloat(String(doubletimeRow[8] ?? 0)) || 0 : 0,
  };
}

function parseDiscountsReport(csvText: string): DiscountsParseResult {
  const lines = csvText.split(/\r?\n/);

  const fromDateLine = lines.find((line) => line.startsWith('From Date:'));
  const fromDateMatch = fromDateLine?.match(/From Date:,(\d{4}-\d{2}-\d{2})/);
  if (!fromDateMatch) {
    throw new Error('Could not find the From Date in this report.');
  }
  const fromDate = new Date(`${fromDateMatch[1]}T00:00:00`);

  const sectionIndex = lines.findIndex((line) => line.includes('GenerateDiscountReport'));
  if (sectionIndex === -1) {
    throw new Error('Could not find the discount detail section in this report.');
  }

  const header = parseCsvLine(lines[sectionIndex + 1]);
  const dateIdx = header.indexOf('date');
  const discountIdx = header.indexOf('discount');
  const amountIdx = header.indexOf('discountAmount');
  const itemDescIdx = header.indexOf('itemDesc');

  if (dateIdx === -1 || discountIdx === -1 || amountIdx === -1) {
    throw new Error('This report is missing expected columns (date, discount, discountAmount).');
  }

  const days = [1, 2, 3, 4, 5, 6, 7];
  const categories: DiscountCategoryResult[] = DISCOUNT_REASON_CATEGORIES.map((c) => ({
    label: c.label,
    dailyCounts: days.map(() => 0),
    dailyAmounts: days.map(() => 0),
    totalCount: 0,
    totalAmount: 0,
    items: [],
  }));

  let rowIndex = sectionIndex + 2;
  while (rowIndex < lines.length && lines[rowIndex].trim() !== '') {
    const row = parseCsvLine(lines[rowIndex]);
    const rowDateStr = row[dateIdx];
    const reason = normalizeDiscountReason(row[discountIdx] ?? '');
    const amount = parseFloat(row[amountIdx]);
    const itemDesc = itemDescIdx !== -1 ? (row[itemDescIdx] ?? '').trim() : '';

    const categoryIndex = DISCOUNT_REASON_CATEGORIES.findIndex((c) => c.match === reason);

    if (categoryIndex !== -1 && rowDateStr && !isNaN(amount)) {
      const rowDate = new Date(rowDateStr.split(' ')[0] + 'T00:00:00');
      const dayNumber = Math.round((rowDate.getTime() - fromDate.getTime()) / 86400000) + 1;
      const dayPos = days.indexOf(dayNumber);

      if (dayPos !== -1) {
        const category = categories[categoryIndex];
        category.dailyCounts[dayPos] += 1;
        category.dailyAmounts[dayPos] += amount;
        category.totalCount += 1;
        category.totalAmount += amount;

        if (itemDesc) {
          const existingItem = category.items.find((i) => i.itemDesc === itemDesc);
          if (existingItem) {
            existingItem.count += 1;
            existingItem.amount += amount;
          } else {
            category.items.push({ itemDesc, count: 1, amount });
          }
        }
      }
    }

    rowIndex++;
  }

  categories.forEach((category) => {
    category.items.sort((a, b) => b.count - a.count);
  });

  return { days, categories };
}

function buildDiscountsSummary(result: DiscountsParseResult): string {
  const activeCategories = result.categories.filter((c) => c.totalCount > 0);

  if (activeCategories.length === 0) {
    return 'No discounts were recorded in this report.';
  }

  const sentences = activeCategories.map((category) => {
    const topItems = category.items.slice(0, 3);
    const itemList = topItems
      .map((item) => `${item.itemDesc} (${item.count}x, $${item.amount.toFixed(2)})`)
      .join(', ');
    const remaining = category.items.length - topItems.length;
    const itemSuffix = remaining > 0 ? `, and ${remaining} other item${remaining === 1 ? '' : 's'}` : '';

    return `${category.label}: ${category.totalCount} discount${category.totalCount === 1 ? '' : 's'} totaling $${category.totalAmount.toFixed(2)}${
      itemList ? ` — ${itemList}${itemSuffix}` : ''
    }.`;
  });

  return sentences.join(' ');
}

const MEAL_PERIODS = ['Lunch', 'Dinner', 'Night'] as const;
type MealPeriod = typeof MEAL_PERIODS[number];

type SpeedOfServiceParseResult = {
  expediter: Record<MealPeriod, number> & { average: number };
  windowTime: Record<MealPeriod, number> & { average: number };
};

function parseTimeToSeconds(value: string): number {
  const [minutes, seconds] = value.trim().split(':').map((v) => parseInt(v, 10));
  return (minutes || 0) * 60 + (seconds || 0);
}

function formatSecondsAsTime(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalSeconds));
  const minutes = Math.floor(abs / 60);
  const seconds = abs % 60;
  return `${sign}${minutes}:${String(seconds).padStart(2, '0')}`;
}

function parseSpeedOfServiceReport(csvText: string): SpeedOfServiceParseResult {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) {
    throw new Error('This report has no data rows.');
  }

  const header = parseCsvLine(lines[0]);
  const viewTypeIdx = header.indexOf('View Type');
  const viewIdx = header.indexOf('View');
  const mealPeriodIdx = header.indexOf('Meal Period');
  const avgBumpIdx = header.indexOf('Average Bump Time');
  const totalAvgBumpIdx = header.indexOf('Total Average Bump Time');

  if (viewTypeIdx === -1 || viewIdx === -1 || mealPeriodIdx === -1 || avgBumpIdx === -1 || totalAvgBumpIdx === -1) {
    throw new Error('This report is missing expected columns.');
  }

  const rows = lines.slice(1).map((line) => parseCsvLine(line));

  const findSeconds = (viewType: string, view: string, mealPeriod: string, column: number) => {
    const row = rows.find(
      (r) => r[viewTypeIdx] === viewType && r[viewIdx] === view && r[mealPeriodIdx] === mealPeriod
    );
    return row ? parseTimeToSeconds(row[column]) : null;
  };

  const expediter = {} as Record<MealPeriod, number> & { average: number };
  const windowTime = {} as Record<MealPeriod, number> & { average: number };

  MEAL_PERIODS.forEach((period) => {
    const dineInSeconds = findSeconds('Expediter', 'Dine In', period, avgBumpIdx);
    const expoSeconds = findSeconds('Expediter', 'Expo', period, avgBumpIdx);
    const pivotSeconds = findSeconds('Assembler', 'Pivot', period, avgBumpIdx);

    if (dineInSeconds === null) {
      throw new Error(`Could not find Expediter / Dine In data for ${period}.`);
    }
    if (expoSeconds === null || pivotSeconds === null) {
      throw new Error(`Could not find Expediter / Expo or Assembler / Pivot data for ${period}.`);
    }

    expediter[period] = dineInSeconds;
    windowTime[period] = expoSeconds - pivotSeconds;
  });

  const dineInAverage = findSeconds('Expediter', 'Dine In', 'Lunch', totalAvgBumpIdx);
  const expoAverage = findSeconds('Expediter', 'Expo', 'Lunch', totalAvgBumpIdx);
  const pivotAverage = findSeconds('Assembler', 'Pivot', 'Lunch', totalAvgBumpIdx);

  if (dineInAverage === null || expoAverage === null || pivotAverage === null) {
    throw new Error('Could not find the total average bump times in this report.');
  }

  expediter.average = dineInAverage;
  windowTime.average = expoAverage - pivotAverage;

  return { expediter, windowTime };
}

function calculateTransferAmount(entry: TransferEntry): { dayWage: number; amount: number } {
  const annualWage = parseFloat(entry.annualWage) || 0;
  const days = parseFloat(entry.days) || 0;
  const dayWage = annualWage / 52 / 5;
  return { dayWage, amount: dayWage * days };
}

function summarizeTransfers(entries: TransferEntry[]) {
  const totals: Record<TransferDestination, number> = { vacation: 0, management: 0, other: 0 };
  const noteLines: string[] = [];

  entries.forEach((entry) => {
    const { dayWage, amount } = calculateTransferAmount(entry);
    if (amount === 0) return;
    totals[entry.destination] += amount;

    const destinationLabel = TRANSFER_DESTINATIONS.find((d) => d.value === entry.destination)?.label ?? '';
    const days = parseFloat(entry.days) || 0;
    const reason = entry.reason.trim();
    noteLines.push(
      `${destinationLabel}: $${amount.toFixed(2)} (${days} day${days === 1 ? '' : 's'} @ $${dayWage.toFixed(2)}/day)${
        reason ? ` — ${reason}` : ''
      }`
    );
  });

  return {
    vacation: totals.vacation,
    management: totals.management,
    other: totals.other,
    notes: noteLines.join('\n'),
  };
}

function createBlankTransferEntry(): TransferEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    annualWage: '',
    days: '',
    destination: 'vacation',
    reason: '',
  };
}

export type GuidedFieldUpdates = {
  budget_food_sales_period?: number;
  labour_budget_pct?: number;
  food_sales_labour_push?: number;
  labour_spent?: number;
  overtime_amount?: number;
  overtime_notes?: string;
  boh_promo_amount?: number;
  labour_transfer_vacation?: number;
  labour_transfer_management?: number;
  labour_transfer_other?: number;
  labour_transfer_notes?: string;
  labour_review_action_plan?: string;
  discount_review_notes?: string;
  speed_of_service_notes?: string;
  sales_action_plan?: string;
};

interface GuidedWeeklyPackageProps {
  initialValues?: GuidedFieldUpdates;
  onFieldsChange?: (updates: GuidedFieldUpdates) => void;
  onClose?: () => void;
  locationId?: string;
  locationName?: string;
  fiscalYear?: number;
  periodNumber?: number;
  weekNumber?: number;
}

export function GuidedWeeklyPackage({
  initialValues,
  onFieldsChange,
  onClose,
  locationId,
  locationName = '',
  fiscalYear,
  periodNumber,
  weekNumber,
}: GuidedWeeklyPackageProps) {
  const [step, setStep] = useState<GuidedStep>('start');
  const [salesBudget, setSalesBudget] = useState(
    initialValues?.budget_food_sales_period ? String(initialValues.budget_food_sales_period) : ''
  );
  const [labourBudgetPct, setLabourBudgetPct] = useState(
    initialValues?.labour_budget_pct ? String(initialValues.labour_budget_pct) : ''
  );
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [salesResult, setSalesResult] = useState<ProfitCenterParseResult | null>(null);
  const [salesError, setSalesError] = useState('');
  const [transferEntries, setTransferEntries] = useState<TransferEntry[]>([createBlankTransferEntry()]);
  const [overtimeNotes, setOvertimeNotes] = useState(initialValues?.overtime_notes ?? '');
  const [labourReviewActionPlan, setLabourReviewActionPlan] = useState(
    initialValues?.labour_review_action_plan ?? ''
  );
  const [discountsFile, setDiscountsFile] = useState<File | null>(null);
  const [discountsResult, setDiscountsResult] = useState<DiscountsParseResult | null>(null);
  const [discountsError, setDiscountsError] = useState('');
  const [discountReviewNotes, setDiscountReviewNotes] = useState(initialValues?.discount_review_notes ?? '');
  const [speedFile, setSpeedFile] = useState<File | null>(null);
  const [speedResult, setSpeedResult] = useState<SpeedOfServiceParseResult | null>(null);
  const [speedError, setSpeedError] = useState('');
  const [speedOfServiceNotes, setSpeedOfServiceNotes] = useState(initialValues?.speed_of_service_notes ?? '');
  const [salesActionPlan, setSalesActionPlan] = useState(initialValues?.sales_action_plan ?? '');

  const handleSalesBudgetChange = (value: string) => {
    setSalesBudget(value);
    onFieldsChange?.({ budget_food_sales_period: parseFloat(value) || 0 });
  };

  const handleLabourBudgetPctChange = (value: string) => {
    setLabourBudgetPct(value);
    onFieldsChange?.({ labour_budget_pct: parseFloat(value) || 0 });
  };

  const handleSalesFileSelect = async (file: File) => {
    setSalesFile(file);
    setSalesError('');
    setSalesResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const result = parseProfitCenterReport(buffer);
      setSalesResult(result);
      const totals = summarizeTransfers(transferEntries);
      onFieldsChange?.({
        food_sales_labour_push: result.salesTotal,
        labour_spent: result.labourTotal - totals.vacation - totals.management - totals.other,
        overtime_amount: result.overtimeTotal,
      });
    } catch (err) {
      setSalesError(err instanceof Error ? err.message : 'Failed to parse this report.');
    }
  };

  const handleTransferEntriesChange = (entries: TransferEntry[]) => {
    setTransferEntries(entries);
    const summary = summarizeTransfers(entries);
    onFieldsChange?.({
      labour_transfer_vacation: summary.vacation,
      labour_transfer_management: summary.management,
      labour_transfer_other: summary.other,
      labour_transfer_notes: summary.notes,
      ...(salesResult
        ? { labour_spent: salesResult.labourTotal - summary.vacation - summary.management - summary.other }
        : {}),
    });
  };

  const handleOvertimeNotesChange = (value: string) => {
    setOvertimeNotes(value);
    onFieldsChange?.({ overtime_notes: value });
  };

  const handleLabourReviewActionPlanChange = (value: string) => {
    setLabourReviewActionPlan(value);
    onFieldsChange?.({ labour_review_action_plan: value });
  };

  const handleDiscountsFileSelect = async (file: File) => {
    setDiscountsFile(file);
    setDiscountsError('');
    setDiscountsResult(null);

    try {
      const text = await file.text();
      const result = parseDiscountsReport(text);
      setDiscountsResult(result);
      const totalAmount = result.categories.reduce((sum, c) => sum + c.totalAmount, 0);
      onFieldsChange?.({ boh_promo_amount: totalAmount });
    } catch (err) {
      setDiscountsError(err instanceof Error ? err.message : 'Failed to parse this report.');
    }
  };

  const handleDiscountReviewNotesChange = (value: string) => {
    setDiscountReviewNotes(value);
    onFieldsChange?.({ discount_review_notes: value });
  };

  const handleSpeedFileSelect = async (file: File) => {
    setSpeedFile(file);
    setSpeedError('');
    setSpeedResult(null);

    try {
      const text = await file.text();
      const result = parseSpeedOfServiceReport(text);
      setSpeedResult(result);
    } catch (err) {
      setSpeedError(err instanceof Error ? err.message : 'Failed to parse this report.');
    }
  };

  const handleSpeedOfServiceNotesChange = (value: string) => {
    setSpeedOfServiceNotes(value);
    onFieldsChange?.({ speed_of_service_notes: value });
  };

  const handleSalesActionPlanChange = (value: string) => {
    setSalesActionPlan(value);
    onFieldsChange?.({ sales_action_plan: value });
  };

  const transferTotals = summarizeTransfers(transferEntries);
  const discountsTotal = discountsResult
    ? discountsResult.categories.reduce((sum, c) => sum + c.totalAmount, 0)
    : 0;

  let content;

  if (step === 'sales') {
    content = (
      <GuidedSalesStep
        salesBudget={salesBudget}
        onSalesBudgetChange={handleSalesBudgetChange}
        labourBudgetPct={labourBudgetPct}
        onLabourBudgetPctChange={handleLabourBudgetPctChange}
        file={salesFile}
        result={salesResult}
        error={salesError}
        onFileSelect={handleSalesFileSelect}
        onBack={() => setStep('start')}
        onNext={() => setStep('transfers')}
      />
    );
  } else if (step === 'transfers') {
    content = (
      <GuidedTransfersStep
        entries={transferEntries}
        onEntriesChange={handleTransferEntriesChange}
        salesResult={salesResult}
        onBack={() => setStep('sales')}
        onNext={() => setStep('overtime')}
      />
    );
  } else if (step === 'overtime') {
    content = (
      <GuidedOvertimeStep
        result={salesResult}
        notes={overtimeNotes}
        onNotesChange={handleOvertimeNotesChange}
        onBack={() => setStep('transfers')}
        onNext={() => setStep('review')}
      />
    );
  } else if (step === 'review') {
    content = (
      <GuidedLabourReviewStep
        wtdSales={salesResult?.salesTotal ?? initialValues?.food_sales_labour_push ?? 0}
        wtdLabour={
          salesResult
            ? salesResult.labourTotal - transferTotals.vacation - transferTotals.management - transferTotals.other
            : initialValues?.labour_spent ?? 0
        }
        wtdBudgetPct={parseFloat(labourBudgetPct) || 0}
        locationId={locationId}
        fiscalYear={fiscalYear}
        periodNumber={periodNumber}
        weekNumber={weekNumber}
        actionPlan={labourReviewActionPlan}
        onActionPlanChange={handleLabourReviewActionPlanChange}
        onBack={() => setStep('overtime')}
        onNext={() => setStep('discounts')}
      />
    );
  } else if (step === 'discounts') {
    content = (
      <GuidedDiscountsStep
        file={discountsFile}
        result={discountsResult}
        error={discountsError}
        onFileSelect={handleDiscountsFileSelect}
        notes={discountReviewNotes}
        onNotesChange={handleDiscountReviewNotesChange}
        onBack={() => setStep('review')}
        onNext={() => setStep('speedOfService')}
      />
    );
  } else if (step === 'speedOfService') {
    content = (
      <GuidedSpeedOfServiceStep
        file={speedFile}
        result={speedResult}
        error={speedError}
        onFileSelect={handleSpeedFileSelect}
        notes={speedOfServiceNotes}
        onNotesChange={handleSpeedOfServiceNotesChange}
        onBack={() => setStep('discounts')}
        onNext={() => setStep('salesRecap')}
      />
    );
  } else if (step === 'salesRecap') {
    content = (
      <GuidedSalesRecapStep
        wtdSales={salesResult?.salesTotal ?? initialValues?.food_sales_labour_push ?? 0}
        wtdSalesBudget={parseFloat(salesBudget) || 0}
        discountsTotal={discountsTotal}
        windowTimeAverage={speedResult?.windowTime.average ?? null}
        locationId={locationId}
        fiscalYear={fiscalYear}
        periodNumber={periodNumber}
        weekNumber={weekNumber}
        actionPlan={salesActionPlan}
        onActionPlanChange={handleSalesActionPlanChange}
        onBack={() => setStep('speedOfService')}
      />
    );
  } else {
    content = (
      <GuidedPackageStart
        locationName={locationName}
        onStart={() => setStep('sales')}
      />
    );
  }

  return (
    <div>
      {onClose && (
        <div className="max-w-2xl mx-auto mb-2 flex justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors shadow"
            title="Close guide"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        </div>
      )}
      {content}
    </div>
  );
}

function StepProgressHeader({ meta }: { meta: StepMeta }) {
  const pct = Math.round((meta.overallIndex / TOTAL_STEPS) * 100);

  return (
    <>
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>
          Section {meta.section}: {meta.sectionLabel} — Step {meta.sectionStepIndex} of {meta.sectionStepCount}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-slate-800 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <h2 className="text-xl font-bold text-slate-800">
        Step {meta.overallIndex}: {meta.stepLabel}
      </h2>
    </>
  );
}

function GuidedPackageStart({
  locationName,
  onStart,
}: {
  locationName: string;
  onStart: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-slate-800 rounded-lg">
          <ClipboardCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Weekly Culinary Package</h1>
          <p className="text-sm text-slate-500">Guided report upload and review workflow</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Restaurant</p>
          <p className="text-base font-semibold text-slate-800">{locationName}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Reporting Period</p>
          <p className="text-base font-semibold text-slate-800">P11 W2</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Steps</p>
          <p className="text-base font-semibold text-slate-800">Step 0 of {TOTAL_STEPS}</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Progress</span>
          <span>0%</span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-slate-800 rounded-full" style={{ width: '0%' }} />
        </div>
      </div>

      <p className="text-slate-600 mt-6 leading-relaxed">
        Welcome, Chef. This guided workflow will walk you through each report required for your
        weekly culinary package.
      </p>

      <button
        onClick={onStart}
        className="mt-8 w-full bg-slate-800 text-white font-medium py-3 rounded-lg hover:bg-slate-700 transition-colors"
      >
        Start Package
      </button>
    </div>
  );
}

function GuidedSalesStep({
  salesBudget,
  onSalesBudgetChange,
  labourBudgetPct,
  onLabourBudgetPctChange,
  file,
  result,
  error,
  onFileSelect,
  onBack,
  onNext,
}: {
  salesBudget: string;
  onSalesBudgetChange: (value: string) => void;
  labourBudgetPct: string;
  onLabourBudgetPctChange: (value: string) => void;
  file: File | null;
  result: ProfitCenterParseResult | null;
  error: string;
  onFileSelect: (file: File) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const days = [1, 2, 3, 4, 5, 6, 7];

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.sales} />

      <p className="mt-4 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        Before you begin, ensure all punch adjustments have been reviewed.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Sales Budget
          </label>
          <input
            type="number"
            value={salesBudget}
            onChange={(e) => onSalesBudgetChange(e.target.value)}
            placeholder="Enter sales budget"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Labour Budget %
          </label>
          <input
            type="number"
            value={labourBudgetPct}
            onChange={(e) => onLabourBudgetPctChange(e.target.value)}
            placeholder="Enter labour budget %"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
          />
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-base font-semibold text-slate-800">Upload Sales Report</h3>
        <p className="text-sm text-slate-600 mt-1">
          Push &gt; Reports &gt; Sales &gt; Profit Center Report &gt; Select Dates &gt; Run &gt;
          Download as Excel &gt; Upload here
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`mt-4 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? 'border-slate-800 bg-slate-50' : 'border-slate-300'
          }`}
        >
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-3">Drag and drop your report here, or</p>
          <label className="inline-block bg-slate-800 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
            Browse Files
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        </div>

        {file && !error && result && (
          <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">Uploaded: {file.name}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {result && (
          <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Metric</th>
                  {days.map((day) => (
                    <th key={day} className="px-3 py-2 text-right font-medium text-slate-500">
                      Day {day}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200">
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">Sales Total</td>
                  {result.salesDaily.map((value, i) => (
                    <td key={i} className="px-3 py-2 text-right text-slate-700">
                      {formatCurrency(value)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">
                    {formatCurrency(result.salesTotal)}
                  </td>
                </tr>
                <tr className="border-t border-slate-200">
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">Labor Total</td>
                  {result.labourDaily.map((value, i) => (
                    <td key={i} className="px-3 py-2 text-right text-slate-700">
                      {formatCurrency(value)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">
                    {formatCurrency(result.labourTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {result && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-500 uppercase">Sales Total</p>
              <p className="text-lg font-semibold text-slate-800 mt-1">
                {formatCurrency(result.salesTotal)}
              </p>
            </div>
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-500 uppercase">Labour %</p>
              <p className="text-lg font-semibold text-slate-800 mt-1">
                {result.salesTotal > 0
                  ? `${((result.labourTotal / result.salesTotal) * 100).toFixed(2)}%`
                  : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function GuidedTransfersStep({
  entries,
  onEntriesChange,
  salesResult,
  onBack,
  onNext,
}: {
  entries: TransferEntry[];
  onEntriesChange: (entries: TransferEntry[]) => void;
  salesResult: ProfitCenterParseResult | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const formatCurrency = (value: number) =>
    value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const updateEntry = (id: string, field: keyof TransferEntry, value: string) => {
    onEntriesChange(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const addEntry = () => {
    onEntriesChange([...entries, createBlankTransferEntry()]);
  };

  const removeEntry = (id: string) => {
    onEntriesChange(entries.filter((e) => e.id !== id));
  };

  const totals = summarizeTransfers(entries);
  const totalTransferred = totals.vacation + totals.management + totals.other;
  const netLabour = salesResult ? salesResult.labourTotal - totalTransferred : 0;

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.transfers} />

      <p className="mt-4 text-sm text-slate-600 leading-relaxed">
        Calculate a day wage for any labour to transfer out of this week's labour cost. For example,
        a $52,000 annual wage ÷ 52 weeks ÷ 5 days = $200/day. If 3 days need to move to Management
        Labour because the chef was on holidays and the sous covered, enter that below.
      </p>

      <div className="mt-6 space-y-4">
        {entries.map((entry, index) => {
          const { dayWage, amount } = calculateTransferAmount(entry);
          return (
            <div key={entry.id} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-700">Transfer {index + 1}</p>
                {entries.length > 1 && (
                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-colors"
                    title="Remove this transfer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Annual Wage</label>
                  <input
                    type="number"
                    value={entry.annualWage}
                    onChange={(e) => updateEntry(entry.id, 'annualWage', e.target.value)}
                    placeholder="e.g. 52000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Days to Transfer</label>
                  <input
                    type="number"
                    value={entry.days}
                    onChange={(e) => updateEntry(entry.id, 'days', e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Move To</label>
                  <select
                    value={entry.destination}
                    onChange={(e) => updateEntry(entry.id, 'destination', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white"
                  >
                    {TRANSFER_DESTINATIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Day Wage / Amount <span className="text-slate-400">(calculated)</span>
                  </label>
                  <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 text-sm font-medium">
                    ${formatCurrency(dayWage)}/day &rarr; ${formatCurrency(amount)}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Reason</label>
                  <input
                    type="text"
                    value={entry.reason}
                    onChange={(e) => updateEntry(entry.id, 'reason', e.target.value)}
                    placeholder="e.g. Chef on holidays 3 days, sous covered"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
              </div>
            </div>
          );
        })}

        <button
          onClick={addEntry}
          className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Transfer
        </button>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {TRANSFER_DESTINATIONS.map((d) => (
          <div key={d.value} className="bg-slate-50 rounded-lg p-4">
            <p className="text-xs font-medium text-slate-500 uppercase">{d.label}</p>
            <p className="text-base font-semibold text-slate-800">
              ${formatCurrency(totals[d.value])}
            </p>
          </div>
        ))}
      </div>

      {salesResult && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="border border-slate-200 rounded-lg p-4">
            <p className="text-xs font-medium text-slate-500 uppercase">Sales Total</p>
            <p className="text-lg font-semibold text-slate-800 mt-1">
              {formatCurrency(salesResult.salesTotal)}
            </p>
          </div>
          <div className="border border-slate-200 rounded-lg p-4">
            <p className="text-xs font-medium text-slate-500 uppercase">Labour % (after transfers)</p>
            <p className="text-lg font-semibold text-slate-800 mt-1">
              {salesResult.salesTotal > 0
                ? `${((netLabour / salesResult.salesTotal) * 100).toFixed(2)}%`
                : '—'}
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function GuidedOvertimeStep({
  result,
  notes,
  onNotesChange,
  onBack,
  onNext,
}: {
  result: ProfitCenterParseResult | null;
  notes: string;
  onNotesChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const days = [1, 2, 3, 4, 5, 6, 7];
  const formatCurrency = (value: number) =>
    value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const hasOvertime = !!result && result.overtimeTotal > 0;
  const hasDoubletime = !!result && result.doubletimeTotal > 0;

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.overtime} />

      <p className="mt-4 text-sm text-slate-600 leading-relaxed">
        Overtime and doubletime are pulled from the Profit Center Report uploaded in Step 1.
      </p>

      {!result && (
        <p className="mt-6 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          Upload the Sales Report in Step 1 to see overtime and doubletime here.
        </p>
      )}

      {result && (
        <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Metric</th>
                {days.map((day) => (
                  <th key={day} className="px-3 py-2 text-right font-medium text-slate-500">
                    Day {day}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium text-slate-500">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">Overtime</td>
                {result.overtimeDaily.map((value, i) => (
                  <td key={i} className="px-3 py-2 text-right text-slate-700">
                    {formatCurrency(value)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-semibold text-slate-800">
                  {formatCurrency(result.overtimeTotal)}
                </td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">Doubletime</td>
                {result.doubletimeDaily.map((value, i) => (
                  <td key={i} className="px-3 py-2 text-right text-slate-700">
                    {formatCurrency(value)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-semibold text-slate-800">
                  {formatCurrency(result.doubletimeTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {hasDoubletime && (
        <p className="mt-3 text-xs text-slate-500">
          Doubletime detected — this is expected on a statutory holiday, no explanation needed.
        </p>
      )}

      {hasOvertime && (
        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Overtime Explanation
          </label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            placeholder="Explain why overtime occurred this week"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
          />
        </div>
      )}

      {result && !hasOvertime && (
        <p className="mt-6 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          No overtime this period.
        </p>
      )}

      <div className="mt-8 flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function GuidedLabourReviewStep({
  wtdSales,
  wtdLabour,
  wtdBudgetPct,
  locationId,
  fiscalYear,
  periodNumber,
  weekNumber,
  actionPlan,
  onActionPlanChange,
  onBack,
  onNext,
}: {
  wtdSales: number;
  wtdLabour: number;
  wtdBudgetPct: number;
  locationId?: string;
  fiscalYear?: number;
  periodNumber?: number;
  weekNumber?: number;
  actionPlan: string;
  onActionPlanChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [baseline, setBaseline] = useState<LabourPlBaseline | null>(null);
  const [weeksRemainingInYear, setWeeksRemainingInYear] = useState(0);
  const [loadingPL, setLoadingPL] = useState(false);
  const [plError, setPlError] = useState('');

  useEffect(() => {
    if (!locationId || !fiscalYear || !periodNumber || !weekNumber) return;

    let cancelled = false;
    setLoadingPL(true);
    setPlError('');

    Promise.all([
      fetchLabourPlBaseline(locationId, fiscalYear, periodNumber, weekNumber),
      getWeeksRemainingInYear(fiscalYear, periodNumber, weekNumber),
    ])
      .then(([baselineResult, weeksRemaining]) => {
        if (cancelled) return;
        if (!baselineResult) {
          setPlError('No P&L data found for this location yet.');
        }
        setBaseline(baselineResult);
        setWeeksRemainingInYear(weeksRemaining);
      })
      .catch(() => {
        if (!cancelled) setPlError('Failed to load P&L data.');
      })
      .finally(() => {
        if (!cancelled) setLoadingPL(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locationId, fiscalYear, periodNumber, weekNumber]);

  const wtdPct = wtdSales > 0 ? (wtdLabour / wtdSales) * 100 : 0;
  const wtdVariance = wtdPct - wtdBudgetPct;

  const ptdLabour = baseline ? (baseline.isCurrentWeek ? baseline.periodLabourActual : baseline.periodLabourActual + wtdLabour) : 0;
  const ptdSales = baseline ? (baseline.isCurrentWeek ? baseline.periodSalesActual : baseline.periodSalesActual + wtdSales) : 0;
  const ptdPct = ptdSales > 0 ? (ptdLabour / ptdSales) * 100 : 0;
  const ptdVarAmount = baseline ? ((ptdPct - baseline.periodBudgetPct) / 100) * ptdSales : 0;

  const ytdLabour = baseline ? (baseline.isCurrentWeek ? baseline.ytdLabourActual : baseline.ytdLabourActual + wtdLabour) : 0;
  const ytdSales = baseline ? (baseline.isCurrentWeek ? baseline.ytdSalesActual : baseline.ytdSalesActual + wtdSales) : 0;
  const ytdPct = ytdSales > 0 ? (ytdLabour / ytdSales) * 100 : 0;
  const ytdVarAmount = baseline ? ((ytdPct - baseline.ytdBudgetPct) / 100) * ytdSales : 0;

  const formatPct = (value: number) => `${value.toFixed(2)}%`;
  const formatCurrency = (value: number) =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const varianceClass = (value: number) =>
    value <= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700';

  const safeWeeksRemaining = Math.max(weeksRemainingInYear, 1);
  const needToSavePerWeek = ytdVarAmount > 0 ? ytdVarAmount / safeWeeksRemaining : 0;
  const needToSavePerDay = needToSavePerWeek / 7;

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.review} />

      <p className="mt-4 text-sm text-slate-600 leading-relaxed">
        Review labour performance for the week, period, and year before moving on to Discounts.
        Period and year figures combine the most recent P&L upload with this week's sales and labour.
      </p>

      {loadingPL && (
        <p className="mt-4 text-sm text-slate-500">Loading P&L data...</p>
      )}

      {plError && !loadingPL && (
        <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          {plError}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Week to Date</p>
          <p className="text-lg font-semibold text-slate-800 mt-1">{formatPct(wtdPct)}</p>
          <p className="text-xs text-slate-500 mt-1">Budget {formatPct(wtdBudgetPct)}</p>
          <div className={`mt-2 px-2 py-1 rounded border text-xs font-medium ${varianceClass(wtdVariance)}`}>
            {wtdVariance > 0 ? '+' : ''}{formatPct(wtdVariance)} variance
          </div>
        </div>
        <div className="border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Period to Date</p>
          <p className="text-lg font-semibold text-slate-800 mt-1">{formatPct(ptdPct)}</p>
          <p className="text-xs text-slate-500 mt-1">Budget {baseline ? formatPct(baseline.periodBudgetPct) : '—'}</p>
          <div className={`mt-2 px-2 py-1 rounded border text-xs font-medium ${varianceClass(ptdVarAmount)}`}>
            {ptdVarAmount > 0 ? '+' : ''}{formatCurrency(ptdVarAmount)} variance
          </div>
        </div>
        <div className="border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Year to Date</p>
          <p className="text-lg font-semibold text-slate-800 mt-1">{formatPct(ytdPct)}</p>
          <p className="text-xs text-slate-500 mt-1">Budget {baseline ? formatPct(baseline.ytdBudgetPct) : '—'}</p>
          <div className={`mt-2 px-2 py-1 rounded border text-xs font-medium ${varianceClass(ytdVarAmount)}`}>
            {ytdVarAmount > 0 ? '+' : ''}{formatCurrency(ytdVarAmount)} variance
          </div>
        </div>
      </div>

      {baseline && (
        <div className={`mt-6 border rounded-lg p-4 ${
          ytdVarAmount > 0 ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'
        }`}>
          <p className={`text-xs font-medium uppercase ${ytdVarAmount > 0 ? 'text-blue-700' : 'text-green-700'}`}>
            Need to Save — Labour (Year to Date)
          </p>
          {ytdVarAmount > 0 ? (
            <>
              <p className="text-xs text-blue-700 mt-1">
                {formatCurrency(ytdVarAmount)} over budget across{' '}
                {safeWeeksRemaining} week{safeWeeksRemaining === 1 ? '' : 's'} remaining in the fiscal year
              </p>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-blue-700 uppercase">Per Week</p>
                  <p className="text-base font-semibold text-blue-900">{formatCurrency(needToSavePerWeek)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-700 uppercase">Per Day</p>
                  <p className="text-base font-semibold text-blue-900">{formatCurrency(needToSavePerDay)}</p>
                </div>
              </div>
            </>
          ) : ptdVarAmount > 0 ? (
            <p className="text-xs text-green-700 mt-1">
              Labour on track year to date. Focus on getting labour back on track for the period.
            </p>
          ) : wtdVariance > 0 ? (
            <p className="text-xs text-green-700 mt-1">
              Labour on track year to date and period to date. Explain your plan to get labour back on track for the week.
            </p>
          ) : (
            <p className="text-xs text-green-700 mt-1">
              Labour on track, YTD, PTD and WTD!
            </p>
          )}
        </div>
      )}

      <div className="mt-8">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Action Plan
        </label>
        <textarea
          value={actionPlan}
          onChange={(e) => onActionPlanChange(e.target.value)}
          rows={4}
          placeholder="Based on the labour review above, what's the plan to address any variances?"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
        />
      </div>

      <div className="mt-8 flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function GuidedDiscountsStep({
  file,
  result,
  error,
  onFileSelect,
  notes,
  onNotesChange,
  onBack,
  onNext,
}: {
  file: File | null;
  result: DiscountsParseResult | null;
  error: string;
  onFileSelect: (file: File) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.discounts} />

      <div className="mt-6">
        <h3 className="text-base font-semibold text-slate-800">Upload Discounts Report</h3>
        <p className="text-sm text-slate-600 mt-1">
          Silverware &gt; Loss Prevention &gt; Discounts &gt; Select Dates &gt; Select Major Classes:
          FOOD-ADD-ONS, FOOD-APPS, FOOD-DESSERTS, FOOD-ENTREES &gt; CSV &gt; Upload below
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`mt-4 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? 'border-slate-800 bg-slate-50' : 'border-slate-300'
          }`}
        >
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-3">Drag and drop your report here, or</p>
          <label className="inline-block bg-slate-800 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
            Browse Files
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        </div>

        {file && !error && result && (
          <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">Uploaded: {file.name}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {result && (
          <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Reason</th>
                  {result.days.map((day) => (
                    <th key={day} className="px-3 py-2 text-right font-medium text-slate-500">
                      Day {day}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Count</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Total $</th>
                </tr>
              </thead>
              <tbody>
                {result.categories.map((category) => (
                  <tr key={category.label} className="border-t border-slate-200">
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{category.label}</td>
                    {category.dailyCounts.map((count, i) => (
                      <td key={i} className="px-3 py-2 text-right text-slate-700">
                        {count}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">
                      {category.totalCount}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">
                      {category.totalAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && (
          <div className="mt-4 border border-slate-200 rounded-lg p-4 bg-slate-50">
            <p className="text-xs font-medium text-slate-500 uppercase">Summary</p>
            <p className="text-sm text-slate-700 mt-2">{buildDiscountsSummary(result)}</p>
          </div>
        )}

        {result && result.categories.some((c) => c.items.length > 0) && (
          <div className="mt-4 space-y-3">
            {result.categories
              .filter((c) => c.items.length > 0)
              .map((category) => (
                <div key={category.label} className="border border-slate-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-800">{category.label}</p>
                  <ul className="mt-2 space-y-1">
                    {category.items.map((item) => (
                      <li
                        key={item.itemDesc}
                        className="flex justify-between text-sm text-slate-600"
                      >
                        <span>{item.itemDesc}</span>
                        <span>
                          {item.count}x · ${item.amount.toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}

        {result && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Chef Comment</label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
              placeholder="Comment on the items above — root causes, trends, or corrective action."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            />
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function GuidedSalesRecapStep({
  wtdSales,
  wtdSalesBudget,
  discountsTotal,
  windowTimeAverage,
  locationId,
  fiscalYear,
  periodNumber,
  weekNumber,
  actionPlan,
  onActionPlanChange,
  onBack,
}: {
  wtdSales: number;
  wtdSalesBudget: number;
  discountsTotal: number;
  windowTimeAverage: number | null;
  locationId?: string;
  fiscalYear?: number;
  periodNumber?: number;
  weekNumber?: number;
  actionPlan: string;
  onActionPlanChange: (value: string) => void;
  onBack: () => void;
}) {
  const [baseline, setBaseline] = useState<SalesPlBaseline | null>(null);
  const [loadingPL, setLoadingPL] = useState(false);
  const [plError, setPlError] = useState('');

  useEffect(() => {
    if (!locationId || !fiscalYear || !periodNumber || !weekNumber) return;

    let cancelled = false;
    setLoadingPL(true);
    setPlError('');

    fetchSalesPlBaseline(locationId, fiscalYear, periodNumber, weekNumber)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setPlError('No P&L data found for this location yet.');
        }
        setBaseline(result);
      })
      .catch(() => {
        if (!cancelled) setPlError('Failed to load P&L data.');
      })
      .finally(() => {
        if (!cancelled) setLoadingPL(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locationId, fiscalYear, periodNumber, weekNumber]);

  const periodBudgetFull = baseline?.periodSalesBudget ?? wtdSalesBudget;
  const weekBudget = periodBudgetFull / 4;
  const weekOfPeriod = weekNumber ?? 1;
  const ptdSalesBudget = weekBudget * weekOfPeriod;
  const ytdSalesBudget = (baseline?.ytdSalesBudget ?? 0) + ptdSalesBudget;

  const ptdSales = baseline ? (baseline.isCurrentWeek ? baseline.periodSalesActual : baseline.periodSalesActual + wtdSales) : 0;
  const ptdVariance = ptdSales - ptdSalesBudget;

  const ytdSales = baseline ? (baseline.isCurrentWeek ? baseline.ytdSalesActual : baseline.ytdSalesActual + wtdSales) : 0;
  const ytdVariance = ytdSales - ytdSalesBudget;

  const wtdVariance = wtdSales - weekBudget;

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const varianceClass = (value: number) =>
    value >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700';

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.salesRecap} />

      <p className="mt-4 text-sm text-slate-600 leading-relaxed">
        Review sales performance for the week, period, and year, along with discounts and line times,
        before writing a sales action plan.
      </p>

      {loadingPL && (
        <p className="mt-4 text-sm text-slate-500">Loading P&L data...</p>
      )}

      {plError && !loadingPL && (
        <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          {plError}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Week to Date</p>
          <p className="text-lg font-semibold text-slate-800 mt-1">{formatCurrency(wtdSales)}</p>
          <p className="text-xs text-slate-500 mt-1">Budget {formatCurrency(weekBudget)}</p>
          <div className={`mt-2 px-2 py-1 rounded border text-xs font-medium ${varianceClass(wtdVariance)}`}>
            {wtdVariance >= 0 ? '+' : ''}{formatCurrency(wtdVariance)} variance
          </div>
        </div>
        <div className="border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Period to Date</p>
          <p className="text-lg font-semibold text-slate-800 mt-1">{formatCurrency(ptdSales)}</p>
          <p className="text-xs text-slate-500 mt-1">Budget {formatCurrency(ptdSalesBudget)}</p>
          <div className={`mt-2 px-2 py-1 rounded border text-xs font-medium ${varianceClass(ptdVariance)}`}>
            {ptdVariance >= 0 ? '+' : ''}{formatCurrency(ptdVariance)} variance
          </div>
        </div>
        <div className="border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Year to Date</p>
          <p className="text-lg font-semibold text-slate-800 mt-1">{formatCurrency(ytdSales)}</p>
          <p className="text-xs text-slate-500 mt-1">Budget {formatCurrency(ytdSalesBudget)}</p>
          <div className={`mt-2 px-2 py-1 rounded border text-xs font-medium ${varianceClass(ytdVariance)}`}>
            {ytdVariance >= 0 ? '+' : ''}{formatCurrency(ytdVariance)} variance
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Discounts (Week)</p>
          <p className="text-lg font-semibold text-slate-800 mt-1">{formatCurrency(discountsTotal)}</p>
        </div>
        <div className="border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Line Times (Week)</p>
          <p className="text-lg font-semibold text-slate-800 mt-1">
            {windowTimeAverage !== null ? formatSecondsAsTime(windowTimeAverage) : '—'}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">Sales Action Plan</label>
        <textarea
          value={actionPlan}
          onChange={(e) => onActionPlanChange(e.target.value)}
          rows={4}
          placeholder="Based on sales, discounts, and line times above, what's the plan for the week ahead?"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
        />
      </div>

      <div className="mt-8 flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}

function GuidedSpeedOfServiceStep({
  file,
  result,
  error,
  onFileSelect,
  notes,
  onNotesChange,
  onBack,
  onNext,
}: {
  file: File | null;
  result: SpeedOfServiceParseResult | null;
  error: string;
  onFileSelect: (file: File) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.speedOfService} />

      <div className="mt-6">
        <h3 className="text-base font-semibold text-slate-800">Upload Speed of Service Summary</h3>
        <p className="text-sm text-slate-600 mt-1">
          Upload the Speed of Service Summary report (CSV) for this week below.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`mt-4 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? 'border-slate-800 bg-slate-50' : 'border-slate-300'
          }`}
        >
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-3">Drag and drop your report here, or</p>
          <label className="inline-block bg-slate-800 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
            Browse Files
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        </div>

        {file && !error && result && (
          <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">Uploaded: {file.name}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {result && (
          <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500"></th>
                  {MEAL_PERIODS.map((period) => (
                    <th key={period} className="px-3 py-2 text-right font-medium text-slate-500">
                      {period}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Average</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200">
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap font-medium">Expediter</td>
                  {MEAL_PERIODS.map((period) => (
                    <td key={period} className="px-3 py-2 text-right text-slate-700">
                      {formatSecondsAsTime(result.expediter[period])}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">
                    {formatSecondsAsTime(result.expediter.average)}
                  </td>
                </tr>
                <tr className="border-t border-slate-200">
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap font-medium">Window Time</td>
                  {MEAL_PERIODS.map((period) => (
                    <td key={period} className="px-3 py-2 text-right text-slate-700">
                      {formatSecondsAsTime(result.windowTime[period])}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">
                    {formatSecondsAsTime(result.windowTime.average)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-slate-400 border-t border-slate-200">
              Window Time = Expo bump time − Pivot bump time
            </p>
          </div>
        )}

        {result && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Chef Comment</label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
              placeholder="Comment on speed of service performance — trends, bottlenecks, or corrective action."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            />
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
