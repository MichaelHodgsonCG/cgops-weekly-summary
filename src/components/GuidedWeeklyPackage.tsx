import { useEffect, useState } from 'react';
import { ClipboardCheck, Upload, CheckCircle2, AlertCircle, X, Plus, Trash2, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { fetchLabourPlBaseline, fetchSalesPlBaseline, fetchFoodCostPlBaseline, getWeeksRemainingInYear, LabourPlBaseline, SalesPlBaseline, FoodCostPlBaseline } from '../lib/needToSave';
import { exportChefSummaryToPdf, FcapRow } from '../lib/chefSummaryExport';

type GuidedStep = 'start' | 'sales' | 'transfers' | 'overtime' | 'review' | 'discounts' | 'speedOfService' | 'salesRecap' | 'cogs' | 'purchases' | 'usageReview' | 'finalFoodCost' | 'finalFoodCostRecap' | 'team' | 'facilities' | 'features' | 'audit' | 'recap';

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
    stepLabel: 'Labour Review',
  },
  discounts: {
    section: 2,
    sectionLabel: 'Sales and Execution',
    sectionStepIndex: 1,
    sectionStepCount: 3,
    overallIndex: 5,
    stepLabel: 'Discounts',
  },
  speedOfService: {
    section: 2,
    sectionLabel: 'Sales and Execution',
    sectionStepIndex: 2,
    sectionStepCount: 3,
    overallIndex: 6,
    stepLabel: 'Speed of Service',
  },
  salesRecap: {
    section: 2,
    sectionLabel: 'Sales and Execution',
    sectionStepIndex: 3,
    sectionStepCount: 3,
    overallIndex: 7,
    stepLabel: 'Sales & Execution Recap',
  },
  cogs: {
    section: 3,
    sectionLabel: 'COGs',
    sectionStepIndex: 1,
    sectionStepCount: 1,
    overallIndex: 8,
    stepLabel: 'COGs Checklist',
  },
  purchases: {
    section: 4,
    sectionLabel: 'Purchases',
    sectionStepIndex: 1,
    sectionStepCount: 1,
    overallIndex: 9,
    stepLabel: 'Purchases',
  },
  usageReview: {
    section: 5,
    sectionLabel: 'Usage Review',
    sectionStepIndex: 1,
    sectionStepCount: 1,
    overallIndex: 10,
    stepLabel: 'Over/Under Usage Review',
  },
  finalFoodCost: {
    section: 6,
    sectionLabel: 'Final Food Cost Report',
    sectionStepIndex: 1,
    sectionStepCount: 2,
    overallIndex: 11,
    stepLabel: 'Final Food Cost Report',
  },
  finalFoodCostRecap: {
    section: 6,
    sectionLabel: 'Final Food Cost Report',
    sectionStepIndex: 2,
    sectionStepCount: 2,
    overallIndex: 12,
    stepLabel: 'Food Cost Recap & Action Plan',
  },
  team: {
    section: 7,
    sectionLabel: 'Team',
    sectionStepIndex: 1,
    sectionStepCount: 1,
    overallIndex: 13,
    stepLabel: 'Team Staffing & Notes',
  },
  facilities: {
    section: 8,
    sectionLabel: 'Facilities',
    sectionStepIndex: 1,
    sectionStepCount: 1,
    overallIndex: 14,
    stepLabel: 'R&M and Cleaning',
  },
  features: {
    section: 9,
    sectionLabel: 'Features',
    sectionStepIndex: 1,
    sectionStepCount: 1,
    overallIndex: 15,
    stepLabel: 'Feature Items',
  },
  audit: {
    section: 10,
    sectionLabel: 'Audit',
    sectionStepIndex: 1,
    sectionStepCount: 1,
    overallIndex: 16,
    stepLabel: 'Last Audit Score',
  },
  recap: {
    section: 11,
    sectionLabel: 'Recap',
    sectionStepIndex: 1,
    sectionStepCount: 1,
    overallIndex: 17,
    stepLabel: 'Weekly Recap',
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

function findRow(rows: any[][], label: string | string[]): any[] | undefined {
  const labels = Array.isArray(label) ? label : [label];
  return rows.find((row) => labels.includes(String(row[0] ?? '').trim()));
}

function parseProfitCenterReport(buffer: ArrayBuffer): ProfitCenterParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets['BOH'];

  if (!sheet) {
    throw new Error('Could not find a "BOH" sheet in this report.');
  }

  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const salesRow = findRow(rows, 'Sales Total');
  const labourRow = findRow(rows, ['Labor Total', 'Labour Total']);
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

// Discount exports vary by locale: dates come through as ISO (2026-06-22) or
// US (6/22/2026). Parse either to a local-midnight Date, dropping any time part.
function parseDiscountDate(value: string): Date | null {
  if (!value) return null;
  const token = value.trim().split(' ')[0];
  const iso = token.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  const us = token.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const d = new Date(`${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseDiscountsReport(csvText: string): DiscountsParseResult {
  const lines = csvText.split(/\r?\n/);

  let fromDate: Date;
  let headerIndex: number;
  let dateIdx: number;
  let discountIdx: number;
  let amountIdx: number;
  let itemDescIdx: number;

  const sectionIndex = lines.findIndex((line) => line.includes('GenerateDiscountReport'));
  const fromDateLine = lines.find((line) => line.startsWith('From Date:'));
  const fromDateMatch = fromDateLine?.match(/From Date:,(\d{4}-\d{2}-\d{2})/);

  if (sectionIndex !== -1 && fromDateMatch) {
    // Legacy "GenerateDiscountReport" export: From Date line + lowercase columns.
    fromDate = new Date(`${fromDateMatch[1]}T00:00:00`);
    headerIndex = sectionIndex + 1;
    const header = parseCsvLine(lines[headerIndex]);
    dateIdx = header.indexOf('date');
    discountIdx = header.indexOf('discount');
    amountIdx = header.indexOf('discountAmount');
    itemDescIdx = header.indexOf('itemDesc');
  } else {
    // Newer "DiscountsDataBit" export: Date Range line + title-case columns.
    const dateRangeLine = lines.find((line) => line.trim().startsWith('Date Range,'));
    const startDateToken = dateRangeLine?.match(/(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4})/)?.[1];
    const parsedFromDate = startDateToken ? parseDiscountDate(startDateToken) : null;
    if (!parsedFromDate) {
      throw new Error('Could not find the date range in this report.');
    }
    fromDate = parsedFromDate;

    headerIndex = lines.findIndex((line) => {
      const fields = parseCsvLine(line);
      return fields[0] === 'Check #' && fields.includes('Reason');
    });
    if (headerIndex === -1) {
      throw new Error('Could not find the discount detail header row in this report.');
    }
    const header = parseCsvLine(lines[headerIndex]);
    dateIdx = header.indexOf('Date');
    discountIdx = header.indexOf('Reason');
    amountIdx = header.indexOf('Discount');
    itemDescIdx = header.indexOf('Item');
  }

  if (dateIdx === -1 || discountIdx === -1 || amountIdx === -1) {
    throw new Error('This report is missing expected columns (date, discount reason, discount amount).');
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

  let rowIndex = headerIndex + 1;
  while (rowIndex < lines.length && lines[rowIndex].trim() !== '') {
    const row = parseCsvLine(lines[rowIndex]);
    const rowDateStr = row[dateIdx];
    const reason = normalizeDiscountReason(row[discountIdx] ?? '');
    const amount = parseFloat(row[amountIdx]);
    const itemDesc = itemDescIdx !== -1 ? (row[itemDescIdx] ?? '').trim() : '';

    const categoryIndex = DISCOUNT_REASON_CATEGORIES.findIndex((c) => c.match === reason);

    const rowDate = parseDiscountDate(rowDateStr ?? '');
    if (categoryIndex !== -1 && rowDate && !isNaN(amount)) {
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

// Locations name the expedite stations differently in their Speed of Service
// report (Beertown's "Expo"/"Dine In", Bauer's "Expo 1", Wildcraft's "Expo Main"
// / "Expo Main Dine-in"), so each role is matched against a list of accepted View
// names, in priority order (exact match, so e.g. "Expo Main" won't catch
// "Expo Main (TO)").
const SPEED_DINE_IN_VIEWS = ['Dine In', 'Expo Main Dine-in', 'Expo (DI)'];
const SPEED_EXPO_VIEWS = ['Expo', 'Expo 1', 'Expo Main', 'Main Expo - Main Expo'];
const SPEED_PIVOT_VIEWS = ['Pivot'];

type SpeedOfServiceParseResult = {
  expediter: Record<MealPeriod, number> & { average: number };
  windowTime: Record<MealPeriod, number> & { average: number };
  expo: Record<MealPeriod, number> & { average: number };
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

// Quote-aware CSV parser that keeps fields containing embedded newlines together.
// The newer QSR export wraps the report title in a multi-line quoted field, so a
// simple line-by-line split would break each record apart.
function parseCsvRecords(csvText: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];

    if (inQuotes) {
      if (char === '"') {
        if (csvText[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && csvText[i + 1] === '\n') i++;
      record.push(field);
      field = '';
      if (record.length > 1 || record[0] !== '') records.push(record);
      record = [];
    } else {
      field += char;
    }
  }

  if (field !== '' || record.length > 0) {
    record.push(field);
    if (record.length > 1 || record[0] !== '') records.push(record);
  }

  return records;
}

function parseSpeedOfServiceReport(csvText: string): SpeedOfServiceParseResult {
  const records = parseCsvRecords(csvText);
  if (records.length === 0) {
    throw new Error('This report has no data rows.');
  }

  const header = records[0];
  const hasHeader = header.indexOf('View Type') !== -1;

  let viewTypeIdx: number;
  let viewIdx: number;
  let mealPeriodIdx: number;
  let avgBumpIdx: number;
  let totalAvgBumpIdx: number;
  let rows: string[][];
  let mealPeriodMatches: (cell: string, period: MealPeriod) => boolean;

  if (hasHeader) {
    // Legacy export: a header row names each column, meal periods match exactly.
    viewTypeIdx = header.indexOf('View Type');
    viewIdx = header.indexOf('View');
    mealPeriodIdx = header.indexOf('Meal Period');
    avgBumpIdx = header.indexOf('Average Bump Time');
    totalAvgBumpIdx = header.indexOf('Total Average Bump Time');

    if (viewTypeIdx === -1 || viewIdx === -1 || mealPeriodIdx === -1 || avgBumpIdx === -1 || totalAvgBumpIdx === -1) {
      throw new Error('This report is missing expected columns.');
    }

    rows = records.slice(1);
    mealPeriodMatches = (cell, period) => cell === period;
  } else {
    // Newer QSR export: no header row, positional columns. The meal-period cell
    // includes its time range (e.g. "Lunch    5:00AM - 4:00PM"), so match on the
    // leading label, and "Night" is reported as "Late Night".
    viewTypeIdx = 4;
    viewIdx = 5;
    mealPeriodIdx = 8;
    avgBumpIdx = 9;
    totalAvgBumpIdx = 11;

    if (header.length <= totalAvgBumpIdx) {
      throw new Error('This report is missing expected columns.');
    }

    rows = records;
    mealPeriodMatches = (cell, period) => {
      const label = (cell ?? '').trim().toLowerCase();
      if (period === 'Night') return label.startsWith('late night') || label.startsWith('night');
      return label.startsWith(period.toLowerCase());
    };
  }

  const totalCountIdx = hasHeader ? header.indexOf('Total Count') : 12;

  // Distinct View names present for a View Type, mapped to their Total Count.
  const viewsOf = (viewType: string) => {
    const seen = new Map<string, number>();
    for (const r of rows) {
      if (r[viewTypeIdx] !== viewType) continue;
      const name = (r[viewIdx] ?? '').trim();
      if (!name || seen.has(name)) continue;
      const count = parseInt(String(r[totalCountIdx] ?? '0').replace(/[^0-9]/g, ''), 10) || 0;
      seen.set(name, count);
    }
    return seen;
  };

  // Resolve a role to an actual View name: first try the known names
  // (case-insensitively, in priority order), then fall back to a heuristic over
  // whatever views the site actually exports — so new naming conventions resolve
  // on their own instead of erroring.
  const resolveView = (
    viewType: string,
    candidates: string[],
    heuristic: (views: Map<string, number>) => string | null
  ): string | null => {
    const views = viewsOf(viewType);
    const names = [...views.keys()];
    for (const cand of candidates) {
      const match = names.find((n) => n.toLowerCase() === cand.toLowerCase());
      if (match) return match;
    }
    return heuristic(views);
  };

  const highestCount = (entries: [string, number][]) =>
    entries.length ? entries.slice().sort((a, b) => b[1] - a[1])[0][0] : null;

  // The main expo and dine-in stations carry essentially every order, so among
  // the expediter views (excluding bar / take-out / dessert / app / prep lines)
  // they're the highest-volume ones; the dine-in one is the *-named variant.
  const isSideStation = (name: string) => /(bar|take|\(to\)|\bto\b|dessert|\bapp\b|prep)/i.test(name);
  const isDineIn = (name: string) => /dine|\(di\)/i.test(name);

  const pivotView = resolveView('Assembler', SPEED_PIVOT_VIEWS, (views) => {
    const entries = [...views.entries()];
    const main = entries.filter(([n]) => /pivot/i.test(n) && !isSideStation(n));
    return highestCount(main.length ? main : entries);
  });
  const expoView = resolveView('Expediter', SPEED_EXPO_VIEWS, (views) => {
    const entries = [...views.entries()].filter(([n]) => !isSideStation(n));
    const nonDine = entries.filter(([n]) => !isDineIn(n));
    return highestCount(nonDine.length ? nonDine : entries);
  });
  const dineInView = resolveView('Expediter', SPEED_DINE_IN_VIEWS, (views) => {
    const entries = [...views.entries()].filter(([n]) => !isSideStation(n));
    const dine = entries.filter(([n]) => isDineIn(n));
    return highestCount(dine.length ? dine : entries);
  });

  if (!dineInView) {
    throw new Error('Could not find an Expediter dine-in view in this report.');
  }
  if (!expoView || !pivotView) {
    throw new Error('Could not find an Expediter expo or Assembler pivot view in this report.');
  }

  const findSeconds = (viewType: string, view: string, mealPeriod: MealPeriod, column: number) => {
    const row = rows.find(
      (r) => r[viewTypeIdx] === viewType && r[viewIdx] === view && mealPeriodMatches(r[mealPeriodIdx], mealPeriod)
    );
    return row ? parseTimeToSeconds(row[column]) : null;
  };

  const expediter = {} as Record<MealPeriod, number> & { average: number };
  const windowTime = {} as Record<MealPeriod, number> & { average: number };
  const expo = {} as Record<MealPeriod, number> & { average: number };

  MEAL_PERIODS.forEach((period) => {
    const dineInSeconds = findSeconds('Expediter', dineInView, period, avgBumpIdx);
    const expoSeconds = findSeconds('Expediter', expoView, period, avgBumpIdx);
    const pivotSeconds = findSeconds('Assembler', pivotView, period, avgBumpIdx);

    if (dineInSeconds === null) {
      throw new Error(`Could not find Expediter / Dine In data for ${period}.`);
    }
    if (expoSeconds === null || pivotSeconds === null) {
      throw new Error(`Could not find Expediter / Expo or Assembler / Pivot data for ${period}.`);
    }

    expediter[period] = dineInSeconds;
    windowTime[period] = expoSeconds - pivotSeconds;
    expo[period] = expoSeconds;
  });

  const dineInAverage = findSeconds('Expediter', dineInView, 'Lunch', totalAvgBumpIdx);
  const expoAverage = findSeconds('Expediter', expoView, 'Lunch', totalAvgBumpIdx);
  const pivotAverage = findSeconds('Assembler', pivotView, 'Lunch', totalAvgBumpIdx);

  if (dineInAverage === null || expoAverage === null || pivotAverage === null) {
    throw new Error('Could not find the total average bump times in this report.');
  }

  expediter.average = dineInAverage;
  windowTime.average = expoAverage - pivotAverage;
  expo.average = expoAverage;

  return { expediter, windowTime, expo };
}

const PURCHASE_CATEGORIES = ['Bakery', 'Dairy', 'Meat And Seafood', 'Other Food', 'Produce'] as const;
type PurchaseCategory = typeof PURCHASE_CATEGORIES[number];

type PurchasesParseResult = {
  categories: { name: PurchaseCategory; amount: number }[];
  total: number;
};

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[$,]/g, '').trim();
  const negative = cleaned.startsWith('-');
  const parsed = parseFloat(cleaned.replace(/^-/, '')) || 0;
  return negative ? -parsed : parsed;
}

function parsePurchasesReport(csvText: string): PurchasesParseResult {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) {
    throw new Error('This report has no data rows.');
  }

  const rows = lines.slice(1).map((line) => parseCsvLine(line));

  const totals: Record<PurchaseCategory, number> = {
    Bakery: 0,
    Dairy: 0,
    'Meat And Seafood': 0,
    'Other Food': 0,
    Produce: 0,
  };

  rows.forEach((row) => {
    const itemName = row[3]?.trim();
    if (PURCHASE_CATEGORIES.includes(itemName as PurchaseCategory)) {
      totals[itemName as PurchaseCategory] += parseCurrency(row[5] ?? '0');
    }
  });

  const categories = PURCHASE_CATEGORIES.map((name) => ({ name, amount: totals[name] }));
  const total = categories.reduce((sum, c) => sum + c.amount, 0);

  return { categories, total };
}

const FOOD_COST_CATEGORIES = ['Bakery', 'Dairy', 'Meat And Seafood', 'Other', 'Produce'] as const;
type FoodCostCategory = typeof FOOD_COST_CATEGORIES[number];

const FOOD_COST_TO_PURCHASE_CATEGORY: Record<FoodCostCategory, PurchaseCategory> = {
  Bakery: 'Bakery',
  Dairy: 'Dairy',
  'Meat And Seafood': 'Meat And Seafood',
  Other: 'Other Food',
  Produce: 'Produce',
};

type FoodCostReportRow = {
  category: FoodCostCategory;
  opening: number;
  closing: number;
  waste: number;
  idealUsage: number;
};

type FoodCostParseResult = {
  foodSalesOC: number;
  rows: FoodCostReportRow[];
};

function parseFoodCostReport(csvText: string): FoodCostParseResult {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) {
    throw new Error('This report has no data rows.');
  }

  const parsedLines = lines.slice(1).map((line) => parseCsvLine(line));
  const foodSalesOC = parseCurrency(parsedLines[0]?.[53] ?? '0');

  const rows = parsedLines
    .filter((row) => FOOD_COST_CATEGORIES.includes(row[66]?.trim() as FoodCostCategory))
    .map((row) => ({
      category: row[66].trim() as FoodCostCategory,
      opening: parseCurrency(row[67] ?? '0'),
      closing: parseCurrency(row[69] ?? '0'),
      idealUsage: parseCurrency(row[72] ?? '0'),
      waste: parseCurrency(row[74] ?? '0'),
    }));

  return { foodSalesOC, rows };
}

type FoodCostCategorySummary = {
  category: FoodCostCategory;
  opening: number;
  closing: number;
  waste: number;
  glPurchases: number;
  actualUsage: number;
  idealUsage: number;
  variance: number;
  pctActualUsage: number;
  pctIdealUsage: number;
  pctWaste: number;
  pctVariance: number;
};

type FoodCostSummary = {
  foodSalesOC: number;
  pushSales: number;
  categories: FoodCostCategorySummary[];
};

function buildFoodCostSummary(
  parsed: FoodCostParseResult,
  glPurchasesByCategory: Record<PurchaseCategory, number>,
  pushSales: number
): FoodCostSummary {
  const { foodSalesOC, rows } = parsed;
  const pctOfSales = (value: number) => (pushSales !== 0 ? (value / pushSales) * 100 : 0);

  const categories = rows.map((row) => {
    const glPurchases = glPurchasesByCategory[FOOD_COST_TO_PURCHASE_CATEGORY[row.category]] ?? 0;
    const actualUsage = row.opening + glPurchases - row.closing - row.waste;
    const variance = actualUsage - row.idealUsage;
    return {
      category: row.category,
      opening: row.opening,
      closing: row.closing,
      waste: row.waste,
      glPurchases,
      actualUsage,
      idealUsage: row.idealUsage,
      variance,
      pctActualUsage: pctOfSales(actualUsage),
      pctIdealUsage: pctOfSales(row.idealUsage),
      pctWaste: pctOfSales(row.waste),
      pctVariance: pctOfSales(variance),
    };
  });

  return { foodSalesOC, pushSales, categories };
}


type UsageReportRow = {
  itemName: string;
  varianceAmount: number;
};

function parseUsageReport(csvText: string): UsageReportRow[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) {
    throw new Error('This report has no data rows.');
  }

  return lines
    .slice(1)
    .map((line) => parseCsvLine(line))
    .map((row) => ({
      itemName: row[35]?.trim() ?? '',
      varianceAmount: parseCurrency(row[39] ?? '0'),
    }))
    .filter((row) => row.itemName !== '');
}

type UsageFlaggedItem = {
  itemName: string;
  direction: 'under' | 'over';
  weekVariance: number;
  fourWeekVariance: number | null;
  confirmed: boolean;
  comment: string;
};

function buildUsageFlaggedItems(
  weekRows: UsageReportRow[],
  fourWeekRows: UsageReportRow[]
): UsageFlaggedItem[] {
  const fourWeekByName = new Map(fourWeekRows.map((row) => [row.itemName, row.varianceAmount]));

  const underUsed = [...weekRows]
    .filter((row) => row.varianceAmount < 0)
    .sort((a, b) => a.varianceAmount - b.varianceAmount)
    .slice(0, 5);

  const overUsed = [...weekRows]
    .filter((row) => row.varianceAmount > 0)
    .sort((a, b) => b.varianceAmount - a.varianceAmount)
    .slice(0, 10);

  const toFlagged = (row: UsageReportRow, direction: 'under' | 'over'): UsageFlaggedItem => ({
    itemName: row.itemName,
    direction,
    weekVariance: row.varianceAmount,
    fourWeekVariance: fourWeekByName.has(row.itemName) ? fourWeekByName.get(row.itemName)! : null,
    confirmed: false,
    comment: '',
  });

  return [
    ...underUsed.map((row) => toFlagged(row, 'under')),
    ...overUsed.map((row) => toFlagged(row, 'over')),
  ];
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
  cogs_confirm_sales?: boolean;
  cogs_brownie_on_us?: boolean;
  cogs_recording_waste?: boolean;
  cogs_petty_cash_amount?: number;
  cogs_internal_transfers?: boolean;
  purchases_invoices_confirmed?: boolean;
  purchases_bakery_amount?: number;
  purchases_dairy_amount?: number;
  purchases_meat_seafood_amount?: number;
  purchases_other_food_amount?: number;
  purchases_produce_amount?: number;
  usage_review_items?: string;
  final_food_cost_items?: string;
  final_food_cost_comments?: string;
  usage_amount?: number;
  ideal_usage_amount?: number;
  waste_amount?: number;
  on_hand_amount?: number;
  food_sales_oc?: number;
  qsr_expo_time?: string;
  window_time?: string;
  sous_vac_days?: number;
  ideal_cooks?: number;
  current_cooks?: number;
  ideal_prep?: number;
  current_prep?: number;
  ideal_dish?: number;
  current_dish?: number;
  ideal_other?: number;
  current_other?: number;
  hiring_notes?: string;
  tm_mots_of_note?: string;
  development_path_updates?: string;
  rm_issues?: string;
  cleaning_focus?: string;
  feature_items?: FeatureItem[];
  features_notes?: string;
  last_audit_score_pct?: number;
  audit_score_comment?: string;
  ai_summary?: string;
  fc_need_save_per_week?: number;
  fc_need_save_per_day?: number;
  labour_need_save_per_week?: number;
  labour_need_save_per_day?: number;
  recap_sales_ytd_actual?: number;
  recap_sales_ytd_budget?: number;
  recap_sales_wtd_actual?: number;
  recap_sales_wtd_budget?: number;
  recap_fc_wtd_pct?: number;
  recap_fc_ptd_pct?: number;
  recap_fc_ytd_pct?: number;
  recap_fc_ytd_budget_pct?: number;
  recap_fc_ytd_variance_amount?: number;
  recap_labour_wtd_pct?: number;
  recap_labour_ptd_pct?: number;
  recap_labour_ytd_pct?: number;
  recap_labour_ytd_budget_pct?: number;
  recap_labour_ytd_variance_amount?: number;
};

function formatRecapMetricsForPrompt(m: GuidedFieldUpdates): string {
  const lines = [
    m.recap_sales_wtd_actual !== undefined && `Sales WTD: $${m.recap_sales_wtd_actual.toFixed(2)} (budget $${(m.recap_sales_wtd_budget ?? 0).toFixed(2)})`,
    m.recap_sales_ytd_actual !== undefined && `Sales YTD: $${m.recap_sales_ytd_actual.toFixed(2)} (budget $${(m.recap_sales_ytd_budget ?? 0).toFixed(2)})`,
    m.recap_fc_wtd_pct !== undefined && `Food Cost WTD: ${m.recap_fc_wtd_pct.toFixed(2)}%`,
    m.recap_fc_ptd_pct !== undefined && `Food Cost PTD: ${m.recap_fc_ptd_pct.toFixed(2)}%`,
    m.recap_fc_ytd_pct !== undefined && `Food Cost YTD: ${m.recap_fc_ytd_pct.toFixed(2)}% (budget ${(m.recap_fc_ytd_budget_pct ?? 0).toFixed(2)}%, variance $${(m.recap_fc_ytd_variance_amount ?? 0).toFixed(2)})`,
    m.recap_labour_wtd_pct !== undefined && `Labour WTD: ${m.recap_labour_wtd_pct.toFixed(2)}%`,
    m.recap_labour_ptd_pct !== undefined && `Labour PTD: ${m.recap_labour_ptd_pct.toFixed(2)}%`,
    m.recap_labour_ytd_pct !== undefined && `Labour YTD: ${m.recap_labour_ytd_pct.toFixed(2)}% (budget ${(m.recap_labour_ytd_budget_pct ?? 0).toFixed(2)}%, variance $${(m.recap_labour_ytd_variance_amount ?? 0).toFixed(2)})`,
  ].filter(Boolean);
  return lines.length ? `Key Numbers:\n${lines.join('\n')}` : '';
}

export type FeatureItem = {
  name: string;
  sold: number;
  notes: string;
};

// One editable "Actions for the Week Ahead" row. `id` is a client-side key only;
// rows are persisted to the weekly_actions table (delete-and-reinsert per week).
export type EditableAction = {
  id: string;
  action_text: string;
  owner: string;
  due_by: string;
  source_section: string;
};

function createBlankAction(source = 'manual'): EditableAction {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    action_text: '',
    owner: '',
    due_by: '',
    source_section: source,
  };
}

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
  const [recapMetrics, setRecapMetrics] = useState<GuidedFieldUpdates>({});
  const handleFieldsChange = (updates: GuidedFieldUpdates) => {
    onFieldsChange?.(updates);
    setRecapMetrics((prev) => ({ ...prev, ...updates }));
  };
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
  const [cogsConfirmSales, setCogsConfirmSales] = useState(initialValues?.cogs_confirm_sales ?? false);
  const [cogsBrownieOnUs, setCogsBrownieOnUs] = useState(initialValues?.cogs_brownie_on_us ?? false);
  const [cogsRecordingWaste, setCogsRecordingWaste] = useState(initialValues?.cogs_recording_waste ?? false);
  const [cogsPettyCashAmount, setCogsPettyCashAmount] = useState(
    initialValues?.cogs_petty_cash_amount !== undefined ? String(initialValues.cogs_petty_cash_amount) : ''
  );
  const [cogsInternalTransfers, setCogsInternalTransfers] = useState(initialValues?.cogs_internal_transfers ?? false);
  const [purchasesInvoicesConfirmed, setPurchasesInvoicesConfirmed] = useState(
    initialValues?.purchases_invoices_confirmed ?? false
  );
  const [purchasesFile, setPurchasesFile] = useState<File | null>(null);
  const [purchasesResult, setPurchasesResult] = useState<PurchasesParseResult | null>(null);
  const [purchasesError, setPurchasesError] = useState('');
  const [usageWeekFile, setUsageWeekFile] = useState<File | null>(null);
  const [usageWeekRows, setUsageWeekRows] = useState<UsageReportRow[] | null>(null);
  const [usageWeekError, setUsageWeekError] = useState('');
  const [usageFourWeekFile, setUsageFourWeekFile] = useState<File | null>(null);
  const [usageFourWeekRows, setUsageFourWeekRows] = useState<UsageReportRow[] | null>(null);
  const [usageFourWeekError, setUsageFourWeekError] = useState('');
  const [usageFlaggedItems, setUsageFlaggedItems] = useState<UsageFlaggedItem[]>(() => {
    if (!initialValues?.usage_review_items) return [];
    try {
      return JSON.parse(initialValues.usage_review_items) as UsageFlaggedItem[];
    } catch {
      return [];
    }
  });
  const [foodCostFile, setFoodCostFile] = useState<File | null>(null);
  const [foodCostSummary, setFoodCostSummary] = useState<FoodCostSummary | null>(() => {
    if (!initialValues?.final_food_cost_items) return null;
    try {
      const parsed = JSON.parse(initialValues.final_food_cost_items);
      if (!parsed || !Array.isArray(parsed.categories)) return null;
      return parsed as FoodCostSummary;
    } catch {
      return null;
    }
  });
  const [foodCostError, setFoodCostError] = useState('');
  const [foodCostComments, setFoodCostComments] = useState(initialValues?.final_food_cost_comments ?? '');

  const [idealCooks, setIdealCooks] = useState(String(initialValues?.ideal_cooks ?? ''));
  const [currentCooks, setCurrentCooks] = useState(String(initialValues?.current_cooks ?? ''));
  const [idealPrep, setIdealPrep] = useState(String(initialValues?.ideal_prep ?? ''));
  const [currentPrep, setCurrentPrep] = useState(String(initialValues?.current_prep ?? ''));
  const [idealDish, setIdealDish] = useState(String(initialValues?.ideal_dish ?? ''));
  const [currentDish, setCurrentDish] = useState(String(initialValues?.current_dish ?? ''));
  const [idealOther, setIdealOther] = useState(String(initialValues?.ideal_other ?? ''));
  const [currentOther, setCurrentOther] = useState(String(initialValues?.current_other ?? ''));
  const [hiringNotes, setHiringNotes] = useState(initialValues?.hiring_notes ?? '');
  const [tmMotsOfNote, setTmMotsOfNote] = useState(initialValues?.tm_mots_of_note ?? '');
  const [developmentPathUpdates, setDevelopmentPathUpdates] = useState(initialValues?.development_path_updates ?? '');

  const [rmIssues, setRmIssues] = useState(initialValues?.rm_issues ?? '');
  const [cleaningFocus, setCleaningFocus] = useState(initialValues?.cleaning_focus ?? '');

  const [featureItems, setFeatureItems] = useState<FeatureItem[]>(
    initialValues?.feature_items && initialValues.feature_items.length > 0
      ? initialValues.feature_items
      : [{ name: '', sold: 0, notes: '' }]
  );
  const [featuresNotes, setFeaturesNotes] = useState(initialValues?.features_notes ?? '');

  const [lastAuditScorePct, setLastAuditScorePct] = useState(
    initialValues?.last_audit_score_pct ? String(initialValues.last_audit_score_pct) : ''
  );
  const [auditScoreComment, setAuditScoreComment] = useState(initialValues?.audit_score_comment ?? '');
  const [priorAuditScore, setPriorAuditScore] = useState<number | null>(null);
  const [loadingAuditScore, setLoadingAuditScore] = useState(false);

  const [aiSummary, setAiSummary] = useState(initialValues?.ai_summary ?? '');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  useEffect(() => {
    if (!locationId || !fiscalYear || !periodNumber || !weekNumber) return;
    if (initialValues?.last_audit_score_pct) return;

    let cancelled = false;
    setLoadingAuditScore(true);

    supabase
      .from('weekly_chef_summary')
      .select('fiscal_year, period_number, week_number, last_audit_score_pct')
      .eq('location_id', locationId)
      .order('fiscal_year', { ascending: false })
      .order('period_number', { ascending: false })
      .order('week_number', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const prior = data.find(
          (row) =>
            row.fiscal_year !== fiscalYear ||
            row.period_number !== periodNumber ||
            row.week_number !== weekNumber
        );
        if (prior) {
          setPriorAuditScore(prior.last_audit_score_pct ?? null);
          if (!lastAuditScorePct) {
            setLastAuditScorePct(String(prior.last_audit_score_pct ?? ''));
            onFieldsChange?.({ last_audit_score_pct: prior.last_audit_score_pct ?? 0 });
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAuditScore(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locationId, fiscalYear, periodNumber, weekNumber]);

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

  const handleSalesDailyChange = (dayIndex: number, value: string) => {
    if (!salesResult) return;
    const salesDaily = salesResult.salesDaily.map((v, i) =>
      i === dayIndex ? parseFloat(value) || 0 : v
    );
    const salesTotal = salesDaily.reduce((sum, v) => sum + v, 0);
    setSalesResult({ ...salesResult, salesDaily, salesTotal });
    onFieldsChange?.({ food_sales_labour_push: salesTotal });
  };

  const handleTransferEntriesChange = (entries: TransferEntry[]) => {
    setTransferEntries(entries);
    const summary = summarizeTransfers(entries);
    const sousVacDays = entries.reduce((sum, entry) => sum + (parseFloat(entry.days) || 0), 0);
    onFieldsChange?.({
      labour_transfer_vacation: summary.vacation,
      labour_transfer_management: summary.management,
      labour_transfer_other: summary.other,
      labour_transfer_notes: summary.notes,
      sous_vac_days: sousVacDays,
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
      onFieldsChange?.({
        qsr_expo_time: formatSecondsAsTime(result.expediter.average),
        window_time: formatSecondsAsTime(result.windowTime.average),
      });
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

  const handleCogsConfirmSalesChange = (value: boolean) => {
    setCogsConfirmSales(value);
    onFieldsChange?.({ cogs_confirm_sales: value });
  };

  const handleCogsBrownieOnUsChange = (value: boolean) => {
    setCogsBrownieOnUs(value);
    onFieldsChange?.({ cogs_brownie_on_us: value });
  };

  const handleCogsRecordingWasteChange = (value: boolean) => {
    setCogsRecordingWaste(value);
    onFieldsChange?.({ cogs_recording_waste: value });
  };

  const handleCogsPettyCashAmountChange = (value: string) => {
    setCogsPettyCashAmount(value);
    onFieldsChange?.({ cogs_petty_cash_amount: parseFloat(value) || 0 });
  };

  const handleCogsInternalTransfersChange = (value: boolean) => {
    setCogsInternalTransfers(value);
    onFieldsChange?.({ cogs_internal_transfers: value });
  };

  const handlePurchasesInvoicesConfirmedChange = (value: boolean) => {
    setPurchasesInvoicesConfirmed(value);
    onFieldsChange?.({ purchases_invoices_confirmed: value });
  };

  const handlePurchasesFileSelect = async (file: File) => {
    setPurchasesFile(file);
    setPurchasesError('');
    setPurchasesResult(null);

    try {
      const text = await file.text();
      const result = parsePurchasesReport(text);
      setPurchasesResult(result);
      const byName = Object.fromEntries(result.categories.map((c) => [c.name, c.amount]));
      onFieldsChange?.({
        purchases_bakery_amount: byName['Bakery'] ?? 0,
        purchases_dairy_amount: byName['Dairy'] ?? 0,
        purchases_meat_seafood_amount: byName['Meat And Seafood'] ?? 0,
        purchases_other_food_amount: byName['Other Food'] ?? 0,
        purchases_produce_amount: byName['Produce'] ?? 0,
      });
    } catch (err) {
      setPurchasesError(err instanceof Error ? err.message : 'Failed to parse this report.');
    }
  };

  const handleUsageWeekFileSelect = async (file: File) => {
    setUsageWeekFile(file);
    setUsageWeekError('');
    setUsageWeekRows(null);

    try {
      const text = await file.text();
      const rows = parseUsageReport(text);
      setUsageWeekRows(rows);
      if (usageFourWeekRows) {
        const flagged = buildUsageFlaggedItems(rows, usageFourWeekRows);
        setUsageFlaggedItems(flagged);
        onFieldsChange?.({ usage_review_items: JSON.stringify(flagged) });
      }
    } catch (err) {
      setUsageWeekError(err instanceof Error ? err.message : 'Failed to parse this report.');
    }
  };

  const handleUsageFourWeekFileSelect = async (file: File) => {
    setUsageFourWeekFile(file);
    setUsageFourWeekError('');
    setUsageFourWeekRows(null);

    try {
      const text = await file.text();
      const rows = parseUsageReport(text);
      setUsageFourWeekRows(rows);
      if (usageWeekRows) {
        const flagged = buildUsageFlaggedItems(usageWeekRows, rows);
        setUsageFlaggedItems(flagged);
        onFieldsChange?.({ usage_review_items: JSON.stringify(flagged) });
      }
    } catch (err) {
      setUsageFourWeekError(err instanceof Error ? err.message : 'Failed to parse this report.');
    }
  };

  const handleUsageItemChange = (index: number, updates: Partial<UsageFlaggedItem>) => {
    setUsageFlaggedItems((prev) => {
      const next = prev.map((item, i) => (i === index ? { ...item, ...updates } : item));
      onFieldsChange?.({ usage_review_items: JSON.stringify(next) });
      return next;
    });
  };

  const handleFoodCostFileSelect = async (file: File) => {
    setFoodCostFile(file);
    setFoodCostError('');
    setFoodCostSummary(null);

    try {
      const text = await file.text();
      const parsed = parseFoodCostReport(text);
      const glPurchasesByCategory: Record<PurchaseCategory, number> = purchasesResult
        ? (Object.fromEntries(purchasesResult.categories.map((c) => [c.name, c.amount])) as Record<
            PurchaseCategory,
            number
          >)
        : {
            Bakery: initialValues?.purchases_bakery_amount ?? 0,
            Dairy: initialValues?.purchases_dairy_amount ?? 0,
            'Meat And Seafood': initialValues?.purchases_meat_seafood_amount ?? 0,
            'Other Food': initialValues?.purchases_other_food_amount ?? 0,
            Produce: initialValues?.purchases_produce_amount ?? 0,
          };
      const pushSales = salesResult?.salesTotal ?? initialValues?.food_sales_labour_push ?? 0;
      const summary = buildFoodCostSummary(parsed, glPurchasesByCategory, pushSales);
      setFoodCostSummary(summary);
      const totals = summary.categories.reduce(
        (acc, c) => ({
          actualUsage: acc.actualUsage + c.actualUsage,
          idealUsage: acc.idealUsage + c.idealUsage,
          waste: acc.waste + c.waste,
          closing: acc.closing + c.closing,
        }),
        { actualUsage: 0, idealUsage: 0, waste: 0, closing: 0 }
      );
      onFieldsChange?.({
        final_food_cost_items: JSON.stringify(summary),
        usage_amount: totals.actualUsage,
        ideal_usage_amount: totals.idealUsage,
        waste_amount: totals.waste,
        on_hand_amount: totals.closing,
      });
    } catch (err) {
      setFoodCostError(err instanceof Error ? err.message : 'Failed to parse this report.');
    }
  };

  const handleFoodCostCommentsChange = (value: string) => {
    setFoodCostComments(value);
    onFieldsChange?.({ final_food_cost_comments: value });
  };

  const handleStaffingChange = (field: 'idealCooks' | 'currentCooks' | 'idealPrep' | 'currentPrep' | 'idealDish' | 'currentDish' | 'idealOther' | 'currentOther', value: string) => {
    const setters: Record<typeof field, (v: string) => void> = {
      idealCooks: setIdealCooks,
      currentCooks: setCurrentCooks,
      idealPrep: setIdealPrep,
      currentPrep: setCurrentPrep,
      idealDish: setIdealDish,
      currentDish: setCurrentDish,
      idealOther: setIdealOther,
      currentOther: setCurrentOther,
    };
    const fieldKeys: Record<typeof field, keyof GuidedFieldUpdates> = {
      idealCooks: 'ideal_cooks',
      currentCooks: 'current_cooks',
      idealPrep: 'ideal_prep',
      currentPrep: 'current_prep',
      idealDish: 'ideal_dish',
      currentDish: 'current_dish',
      idealOther: 'ideal_other',
      currentOther: 'current_other',
    };
    setters[field](value);
    onFieldsChange?.({ [fieldKeys[field]]: parseInt(value) || 0 });
  };

  const handleHiringNotesChange = (value: string) => {
    setHiringNotes(value);
    onFieldsChange?.({ hiring_notes: value });
  };

  const handleTmMotsOfNoteChange = (value: string) => {
    setTmMotsOfNote(value);
    onFieldsChange?.({ tm_mots_of_note: value });
  };

  const handleDevelopmentPathUpdatesChange = (value: string) => {
    setDevelopmentPathUpdates(value);
    onFieldsChange?.({ development_path_updates: value });
  };

  const handleRmIssuesChange = (value: string) => {
    setRmIssues(value);
    onFieldsChange?.({ rm_issues: value });
  };

  const handleCleaningFocusChange = (value: string) => {
    setCleaningFocus(value);
    onFieldsChange?.({ cleaning_focus: value });
  };

  const handleFeatureItemsChange = (items: FeatureItem[]) => {
    setFeatureItems(items);
    onFieldsChange?.({ feature_items: items });
  };

  const handleFeaturesNotesChange = (value: string) => {
    setFeaturesNotes(value);
    onFieldsChange?.({ features_notes: value });
  };

  const handleLastAuditScorePctChange = (value: string) => {
    setLastAuditScorePct(value);
    onFieldsChange?.({ last_audit_score_pct: parseFloat(value) || 0 });
  };

  const handleAuditScoreCommentChange = (value: string) => {
    setAuditScoreComment(value);
    onFieldsChange?.({ audit_score_comment: value });
  };

  const handleGenerateAiSummary = async () => {
    setGeneratingSummary(true);
    setSummaryError('');
    try {
      const chefNotes = [
        formatRecapMetricsForPrompt(recapMetrics),
        foodCostComments && `Food Cost Action Plan: ${foodCostComments}`,
        labourReviewActionPlan && `Labour Action Plan: ${labourReviewActionPlan}`,
        salesActionPlan && `Sales Action Plan: ${salesActionPlan}`,
        hiringNotes && `Hiring: ${hiringNotes}`,
        tmMotsOfNote && `Team Members of Note: ${tmMotsOfNote}`,
        developmentPathUpdates && `Development Path: ${developmentPathUpdates}`,
        rmIssues && `R&M Issues: ${rmIssues}`,
        cleaningFocus && `Cleaning Focus: ${cleaningFocus}`,
        featuresNotes && `Features: ${featuresNotes}`,
        auditScoreComment && `Audit: ${auditScoreComment}`,
      ].filter(Boolean).join('\n');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-chef-summary`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summaries: [
            {
              id: 'current',
              location_name: locationName,
              food_cost_summary: foodCostComments,
              labour_summary: labourReviewActionPlan,
              boh_promo_summary: salesActionPlan,
              notes: chefNotes,
              action_plan_summary: salesActionPlan,
              hiring_notes: hiringNotes,
              tm_mots_of_note: tmMotsOfNote,
              development_path_updates: developmentPathUpdates,
              rm_issues: rmIssues,
              cleaning_focus: cleaningFocus,
              features_notes: featuresNotes,
              audit_score_comment: auditScoreComment,
            },
          ],
        }),
      });

      if (!response.ok) throw new Error('Failed to generate summary');

      const { results } = await response.json();
      const generated = results?.[0]?.ai_summary ?? '';
      setAiSummary(generated);
      onFieldsChange?.({ ai_summary: generated });
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to generate summary.');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleAiSummaryChange = (value: string) => {
    setAiSummary(value);
    onFieldsChange?.({ ai_summary: value });
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
        onSalesDailyChange={handleSalesDailyChange}
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
        onFieldsChange={handleFieldsChange}
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
        dineInExpoAverage={speedResult?.expediter.average ?? null}
        locationId={locationId}
        fiscalYear={fiscalYear}
        periodNumber={periodNumber}
        weekNumber={weekNumber}
        actionPlan={salesActionPlan}
        onActionPlanChange={handleSalesActionPlanChange}
        onFieldsChange={handleFieldsChange}
        onBack={() => setStep('speedOfService')}
        onNext={() => setStep('cogs')}
      />
    );
  } else if (step === 'cogs') {
    content = (
      <GuidedCogsStep
        confirmSales={cogsConfirmSales}
        onConfirmSalesChange={handleCogsConfirmSalesChange}
        brownieOnUs={cogsBrownieOnUs}
        onBrownieOnUsChange={handleCogsBrownieOnUsChange}
        recordingWaste={cogsRecordingWaste}
        onRecordingWasteChange={handleCogsRecordingWasteChange}
        pettyCashAmount={cogsPettyCashAmount}
        onPettyCashAmountChange={handleCogsPettyCashAmountChange}
        internalTransfers={cogsInternalTransfers}
        onInternalTransfersChange={handleCogsInternalTransfersChange}
        onBack={() => setStep('salesRecap')}
        onNext={() => setStep('purchases')}
      />
    );
  } else if (step === 'purchases') {
    content = (
      <GuidedPurchasesStep
        invoicesConfirmed={purchasesInvoicesConfirmed}
        onInvoicesConfirmedChange={handlePurchasesInvoicesConfirmedChange}
        file={purchasesFile}
        result={purchasesResult}
        error={purchasesError}
        onFileSelect={handlePurchasesFileSelect}
        onBack={() => setStep('cogs')}
        onNext={() => setStep('usageReview')}
      />
    );
  } else if (step === 'usageReview') {
    content = (
      <GuidedUsageReviewStep
        weekFile={usageWeekFile}
        weekRows={usageWeekRows}
        weekError={usageWeekError}
        onWeekFileSelect={handleUsageWeekFileSelect}
        fourWeekFile={usageFourWeekFile}
        fourWeekRows={usageFourWeekRows}
        fourWeekError={usageFourWeekError}
        onFourWeekFileSelect={handleUsageFourWeekFileSelect}
        flaggedItems={usageFlaggedItems}
        onItemChange={handleUsageItemChange}
        onBack={() => setStep('purchases')}
        onFinish={() => setStep('finalFoodCost')}
      />
    );
  } else if (step === 'finalFoodCost') {
    content = (
      <GuidedFinalFoodCostStep
        file={foodCostFile}
        summary={foodCostSummary}
        error={foodCostError}
        onFileSelect={handleFoodCostFileSelect}
        onFieldsChange={handleFieldsChange}
        onBack={() => setStep('usageReview')}
        onFinish={() => setStep('finalFoodCostRecap')}
      />
    );
  } else if (step === 'finalFoodCostRecap') {
    content = (
      <GuidedFinalFoodCostRecapStep
        summary={foodCostSummary}
        usageWeekRows={usageWeekRows}
        locationName={locationName}
        comments={foodCostComments}
        onCommentsChange={handleFoodCostCommentsChange}
        onFieldsChange={handleFieldsChange}
        locationId={locationId}
        fiscalYear={fiscalYear}
        periodNumber={periodNumber}
        weekNumber={weekNumber}
        onBack={() => setStep('finalFoodCost')}
        onFinish={() => setStep('team')}
      />
    );
  } else if (step === 'team') {
    content = (
      <GuidedTeamStep
        idealCooks={idealCooks}
        currentCooks={currentCooks}
        idealPrep={idealPrep}
        currentPrep={currentPrep}
        idealDish={idealDish}
        currentDish={currentDish}
        idealOther={idealOther}
        currentOther={currentOther}
        onStaffingChange={handleStaffingChange}
        hiringNotes={hiringNotes}
        onHiringNotesChange={handleHiringNotesChange}
        tmMotsOfNote={tmMotsOfNote}
        onTmMotsOfNoteChange={handleTmMotsOfNoteChange}
        developmentPathUpdates={developmentPathUpdates}
        onDevelopmentPathUpdatesChange={handleDevelopmentPathUpdatesChange}
        onBack={() => setStep('finalFoodCostRecap')}
        onNext={() => setStep('facilities')}
      />
    );
  } else if (step === 'facilities') {
    content = (
      <GuidedFacilitiesStep
        rmIssues={rmIssues}
        onRmIssuesChange={handleRmIssuesChange}
        cleaningFocus={cleaningFocus}
        onCleaningFocusChange={handleCleaningFocusChange}
        onBack={() => setStep('team')}
        onNext={() => setStep('features')}
      />
    );
  } else if (step === 'features') {
    content = (
      <GuidedFeaturesStep
        items={featureItems}
        onItemsChange={handleFeatureItemsChange}
        notes={featuresNotes}
        onNotesChange={handleFeaturesNotesChange}
        onBack={() => setStep('facilities')}
        onNext={() => setStep('audit')}
      />
    );
  } else if (step === 'audit') {
    content = (
      <GuidedAuditStep
        score={lastAuditScorePct}
        onScoreChange={handleLastAuditScorePctChange}
        priorScore={priorAuditScore}
        loadingPriorScore={loadingAuditScore}
        comment={auditScoreComment}
        onCommentChange={handleAuditScoreCommentChange}
        onBack={() => setStep('features')}
        onNext={() => setStep('recap')}
      />
    );
  } else if (step === 'recap') {
    content = (
      <GuidedRecapStep
        locationName={locationName}
        locationId={locationId}
        fiscalYear={fiscalYear}
        periodNumber={periodNumber}
        weekNumber={weekNumber}
        foodCostComments={foodCostComments}
        labourReviewActionPlan={labourReviewActionPlan}
        salesActionPlan={salesActionPlan}
        hiringNotes={hiringNotes}
        tmMotsOfNote={tmMotsOfNote}
        developmentPathUpdates={developmentPathUpdates}
        rmIssues={rmIssues}
        cleaningFocus={cleaningFocus}
        featureItems={featureItems}
        featuresNotes={featuresNotes}
        auditScore={lastAuditScorePct}
        auditScoreComment={auditScoreComment}
        aiSummary={aiSummary}
        onAiSummaryChange={handleAiSummaryChange}
        onGenerate={handleGenerateAiSummary}
        generating={generatingSummary}
        error={summaryError}
        recapMetrics={recapMetrics}
        foodCostSummary={foodCostSummary}
        onBack={() => setStep('audit')}
        onFinish={() => onClose?.()}
      />
    );
  } else {
    content = (
      <GuidedPackageStart
        locationName={locationName}
        locationId={locationId}
        fiscalYear={fiscalYear}
        periodNumber={periodNumber}
        weekNumber={weekNumber}
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

type PriorAction = {
  id: string;
  action_text: string;
  owner: string;
  due_by: string;
  status: string;
  fiscal_year: number;
  period_number: number;
  week_number: number;
};

function GuidedPackageStart({
  locationName,
  locationId,
  fiscalYear,
  periodNumber,
  weekNumber,
  onStart,
}: {
  locationName: string;
  locationId?: string;
  fiscalYear?: number;
  periodNumber?: number;
  weekNumber?: number;
  onStart: () => void;
}) {
  const [priorActions, setPriorActions] = useState<PriorAction[]>([]);
  const [priorLabel, setPriorLabel] = useState('');
  const [loadingPrior, setLoadingPrior] = useState(false);

  // Load the most recent prior week's open/carried actions so the chef can close
  // the loop ("did you do them?") before starting the new week.
  useEffect(() => {
    if (!locationId || !fiscalYear || !periodNumber || !weekNumber) return;

    let cancelled = false;
    setLoadingPrior(true);

    const isBeforeCurrent = (r: { fiscal_year: number; period_number: number; week_number: number }) =>
      r.fiscal_year < fiscalYear ||
      (r.fiscal_year === fiscalYear && r.period_number < periodNumber) ||
      (r.fiscal_year === fiscalYear && r.period_number === periodNumber && r.week_number < weekNumber);

    supabase
      .from('weekly_actions')
      .select('id, action_text, owner, due_by, status, fiscal_year, period_number, week_number, sort_order')
      .eq('location_id', locationId)
      .in('status', ['open', 'carried'])
      .order('fiscal_year', { ascending: false })
      .order('period_number', { ascending: false })
      .order('week_number', { ascending: false })
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data || data.length === 0) return;
        const prior = data.filter(isBeforeCurrent);
        if (prior.length === 0) return;
        const head = prior[0];
        const sameWeek = prior.filter(
          (r) =>
            r.fiscal_year === head.fiscal_year &&
            r.period_number === head.period_number &&
            r.week_number === head.week_number
        );
        setPriorActions(sameWeek as PriorAction[]);
        setPriorLabel(`P${head.period_number} W${head.week_number}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingPrior(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locationId, fiscalYear, periodNumber, weekNumber]);

  const updatePriorStatus = async (id: string, status: 'done' | 'carried' | 'dropped') => {
    setPriorActions((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    await supabase
      .from('weekly_actions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
  };

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

      {!loadingPrior && priorActions.length > 0 && (
        <div className="mt-6 border border-slate-200 rounded-lg p-4 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-800">
            Last week’s actions{priorLabel ? ` (${priorLabel})` : ''}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-3">
            Before you start, close the loop on what you committed to. Carried-over actions stay
            on the list — add them to this week’s plan in the final step.
          </p>
          <div className="space-y-2">
            {priorActions.map((action) => (
              <div
                key={action.id}
                className="bg-white border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3"
              >
                <div className="flex-1">
                  <p className="text-sm text-slate-700">{action.action_text}</p>
                  {(action.owner || action.due_by) && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[action.owner, action.due_by].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(['done', 'carried', 'dropped'] as const).map((s) => {
                    const active = action.status === s;
                    const labels: Record<typeof s, string> = {
                      done: 'Done',
                      carried: 'Carry',
                      dropped: 'Drop',
                    };
                    const activeColor =
                      s === 'done'
                        ? 'bg-green-600 text-white border-green-600'
                        : s === 'carried'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-slate-500 text-white border-slate-500';
                    return (
                      <button
                        key={s}
                        onClick={() => updatePriorStatus(action.id, s)}
                        className={`px-2 py-1 text-xs rounded-md border font-medium transition-colors ${
                          active ? activeColor : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {labels[s]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
  onSalesDailyChange,
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
  onSalesDailyChange: (dayIndex: number, value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [editingSales, setEditingSales] = useState(false);
  const [salesInputs, setSalesInputs] = useState<string[]>([]);
  const days = [1, 2, 3, 4, 5, 6, 7];

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const beginEditingSales = () => {
    setSalesInputs(result ? result.salesDaily.map((v) => String(v)) : []);
    setEditingSales(true);
  };

  const handleSalesInputChange = (index: number, value: string) => {
    setSalesInputs((prev) => prev.map((v, i) => (i === index ? value : v)));
    onSalesDailyChange(index, value);
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
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">
                {editingSales
                  ? 'Editing daily sales — the total updates automatically. Day 7 is Sunday.'
                  : 'Daily breakdown'}
              </p>
              <button
                type="button"
                onClick={() => (editingSales ? setEditingSales(false) : beginEditingSales())}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                {editingSales ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Done editing
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4" /> Edit sales
                  </>
                )}
              </button>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
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
                        {editingSales ? (
                          <input
                            type="number"
                            step="0.01"
                            value={salesInputs[i] ?? ''}
                            onChange={(e) => handleSalesInputChange(i, e.target.value)}
                            className="w-24 px-2 py-1 text-right border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-800"
                          />
                        ) : (
                          formatCurrency(value)
                        )}
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
  onFieldsChange,
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
  onFieldsChange?: (updates: GuidedFieldUpdates) => void;
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

  useEffect(() => {
    onFieldsChange?.({
      labour_need_save_per_week: parseFloat(needToSavePerWeek.toFixed(2)),
      labour_need_save_per_day: parseFloat(needToSavePerDay.toFixed(2)),
      recap_labour_wtd_pct: parseFloat(wtdPct.toFixed(2)),
      recap_labour_ptd_pct: parseFloat(ptdPct.toFixed(2)),
      recap_labour_ytd_pct: parseFloat(ytdPct.toFixed(2)),
      recap_labour_ytd_budget_pct: parseFloat((baseline?.ytdBudgetPct ?? 0).toFixed(2)),
      recap_labour_ytd_variance_amount: parseFloat(ytdVarAmount.toFixed(2)),
    });
  }, [needToSavePerWeek, needToSavePerDay, wtdPct, ptdPct, ytdPct, ytdVarAmount, baseline]);

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
  dineInExpoAverage,
  locationId,
  fiscalYear,
  periodNumber,
  weekNumber,
  actionPlan,
  onActionPlanChange,
  onFieldsChange,
  onBack,
  onNext,
}: {
  wtdSales: number;
  wtdSalesBudget: number;
  discountsTotal: number;
  dineInExpoAverage: number | null;
  locationId?: string;
  fiscalYear?: number;
  periodNumber?: number;
  weekNumber?: number;
  actionPlan: string;
  onActionPlanChange: (value: string) => void;
  onFieldsChange?: (updates: GuidedFieldUpdates) => void;
  onBack: () => void;
  onNext: () => void;
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

  useEffect(() => {
    onFieldsChange?.({
      recap_sales_ytd_actual: parseFloat(ytdSales.toFixed(2)),
      recap_sales_ytd_budget: parseFloat(ytdSalesBudget.toFixed(2)),
      recap_sales_wtd_actual: parseFloat(wtdSales.toFixed(2)),
      recap_sales_wtd_budget: parseFloat(weekBudget.toFixed(2)),
    });
  }, [ytdSales, ytdSalesBudget, wtdSales, weekBudget]);

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
            {dineInExpoAverage !== null ? formatSecondsAsTime(dineInExpoAverage) : '—'}
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

function GuidedCogsStep({
  confirmSales,
  onConfirmSalesChange,
  brownieOnUs,
  onBrownieOnUsChange,
  recordingWaste,
  onRecordingWasteChange,
  pettyCashAmount,
  onPettyCashAmountChange,
  internalTransfers,
  onInternalTransfersChange,
  onBack,
  onNext,
}: {
  confirmSales: boolean;
  onConfirmSalesChange: (value: boolean) => void;
  brownieOnUs: boolean;
  onBrownieOnUsChange: (value: boolean) => void;
  recordingWaste: boolean;
  onRecordingWasteChange: (value: boolean) => void;
  pettyCashAmount: string;
  onPettyCashAmountChange: (value: string) => void;
  internalTransfers: boolean;
  onInternalTransfersChange: (value: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const sections: {
    title: string;
    steps: string[];
    control: 'checkbox' | 'amount';
  }[] = [
    {
      title: '1. Confirm Sales',
      steps: [
        'Click the sales tab.',
        'Hover over each day on the calendar to see if there are mismatched or unlinked sales.',
        'If there are, click on the day and review the items. Fix what you can or email Culinary/Beverage Directors for assistance.',
      ],
      control: 'checkbox',
    },
    {
      title: '2. Brownie on Us',
      steps: [
        'Reports > Sales Mix > Sales Mix by Products > Sales Mix – by Product > Date Range (Ignore desired % of sales) > Run > Search "Brownie on us".',
        'Refer to Brownie on Us Reporting Standard in Discover if necessary.',
        'Enter in the brownie as an invoice: Open a new invoice > Vendor: Transfer Intercompany > invoice number: "Bak2ProP3W3" with the proper per/week > add appropriate date > total on the invoice: $0 > click expense tab > add 2 expenses: Bakery and Promo Other Comps > Description for both: Comp desserts > Enter the comp dessert $ on the bakery line as a negative and the same amount on the Promo line as a positive. (Net amount is zero) > Save the invoice.',
        'If needed, refer to the Transferring Dessert Comps Out of Food Cost Standard.',
      ],
      control: 'checkbox',
    },
    {
      title: '3. Recording Waste',
      steps: [
        'Click on the waste icon.',
        'Click on the appropriate date within the reporting week and click the New Icon.',
        'Record waste from waste sheets accordingly, there are 3 icons: Item - food items we purchase; Prep - food that is prepared in the kitchen; Product - menu items that are sold.',
        'Write down the total waste on the cheat sheet.',
        'Refer to the Entering Waste Standard in Discover if necessary.',
      ],
      control: 'checkbox',
    },
    {
      title: '4. Entering Petty Cash',
      steps: [
        'Get all petty cash receipts from the GM.',
        'Enter items like you are entering an invoice.',
        'Use the name of the store and date as the invoice number.',
        'You may only expense items under $50. All other items should be entered as items.',
      ],
      control: 'amount',
    },
    {
      title: '5. Internal Transfers',
      steps: [
        'Enter items like you are entering an invoice or credit. Ensure to transfer food items only and the bar transfers similar beverage item only. For example, the Kitchen transfers out Limes (Food) and the bar transfers in Limes (Bar).',
        'Use the following invoice number schemes: Kitchen to bar: kit2barP4W1 (current period and week that we are in); Bar to Kitchen: bar2kitP4W1 (current period and week that we are in).',
        'Save as you normally would and print out to go in the invoices folder.',
        'Refer to the OC Transfer Standards on Push if necessary, internal transfers are external transfers are similar.',
      ],
      control: 'checkbox',
    },
  ];

  const checkboxState: Record<string, [boolean, (value: boolean) => void]> = {
    '1. Confirm Sales': [confirmSales, onConfirmSalesChange],
    '2. Brownie on Us': [brownieOnUs, onBrownieOnUsChange],
    '3. Recording Waste': [recordingWaste, onRecordingWasteChange],
    '5. Internal Transfers': [internalTransfers, onInternalTransfersChange],
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.cogs} />

      <p className="mt-4 text-sm text-slate-600 leading-relaxed">
        Work through each Optimum Control task for the week and confirm it's done.
      </p>

      <div className="mt-6 space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="border border-slate-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-slate-800">{section.title}</p>
            <ul className="mt-2 space-y-1 list-disc list-inside text-sm text-slate-600">
              {section.steps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ul>

            {section.control === 'checkbox' ? (
              <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={checkboxState[section.title][0]}
                  onChange={(e) => checkboxState[section.title][1](e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-500"
                />
                Done
              </label>
            ) : (
              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-500 mb-1">Petty Cash Entered ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={pettyCashAmount}
                  onChange={(e) => onPettyCashAmountChange(e.target.value)}
                  placeholder="0.00"
                  className="w-40 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>
            )}
          </div>
        ))}
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

function GuidedPurchasesStep({
  invoicesConfirmed,
  onInvoicesConfirmedChange,
  file,
  result,
  error,
  onFileSelect,
  onBack,
  onNext,
}: {
  invoicesConfirmed: boolean;
  onInvoicesConfirmedChange: (value: boolean) => void;
  file: File | null;
  result: PurchasesParseResult | null;
  error: string;
  onFileSelect: (file: File) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.purchases} />

      <div className="mt-4">
        <h3 className="text-base font-semibold text-slate-800">1. Confirm Invoices</h3>
        <ul className="mt-2 space-y-1 list-disc list-inside text-sm text-slate-600">
          <li>Print Invoice Report: OC &gt; Reports &gt; Accounting &gt; Invoice Account Balances &gt; Select Date Range.</li>
          <li>Organize invoices and ensure each invoice is on the invoice report.</li>
        </ul>
        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={invoicesConfirmed}
            onChange={(e) => onInvoicesConfirmedChange(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-500"
          />
          All invoices are on the invoice report
        </label>
      </div>

      <div className="mt-6">
        <h3 className="text-base font-semibold text-slate-800">2. Upload General Ledger Report</h3>
        <p className="text-sm text-slate-600 mt-1">
          Run the GL report: OC &gt; Reports &gt; Accounting &gt; General Ledger &gt; Date Range &gt; save to CSV &gt; upload below.
        </p>

        {!invoicesConfirmed && (
          <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            Confirm all invoices are on the invoice report above before uploading the GL report.
          </p>
        )}

        <div
          onDragOver={(e) => {
            if (!invoicesConfirmed) return;
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (!invoicesConfirmed) return;
            handleFiles(e.dataTransfer.files);
          }}
          className={`mt-4 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            !invoicesConfirmed ? 'opacity-50 border-slate-200' : dragActive ? 'border-slate-800 bg-slate-50' : 'border-slate-300'
          }`}
        >
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-3">Drag and drop your report here, or</p>
          <label
            className={`inline-block px-4 py-2 rounded-lg transition-colors ${
              invoicesConfirmed
                ? 'bg-slate-800 text-white cursor-pointer hover:bg-slate-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            Browse Files
            <input
              type="file"
              accept=".csv"
              disabled={!invoicesConfirmed}
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
          <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Category</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {result.categories.map((category) => (
                  <tr key={category.name} className="border-t border-slate-200">
                    <td className="px-3 py-2 text-slate-700">{category.name}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(category.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="px-3 py-2 font-semibold text-slate-800">Total</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(result.total)}</td>
                </tr>
              </tbody>
            </table>
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

function UsageReportUploadZone({
  title,
  instructions,
  file,
  rowCount,
  error,
  onFileSelect,
}: {
  title: string;
  instructions: string;
  file: File | null;
  rowCount: number | null;
  error: string;
  onFileSelect: (file: File) => void;
}) {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="text-sm text-slate-600 mt-1">{instructions}</p>

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
        <label className="inline-block px-4 py-2 rounded-lg bg-slate-800 text-white cursor-pointer hover:bg-slate-700 transition-colors">
          Browse Files
          <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </label>
      </div>

      {file && !error && rowCount !== null && (
        <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">
            Uploaded: {file.name} ({rowCount} items)
          </span>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}
    </div>
  );
}

function GuidedUsageReviewStep({
  weekFile,
  weekRows,
  weekError,
  onWeekFileSelect,
  fourWeekFile,
  fourWeekRows,
  fourWeekError,
  onFourWeekFileSelect,
  flaggedItems,
  onItemChange,
  onBack,
  onFinish,
}: {
  weekFile: File | null;
  weekRows: UsageReportRow[] | null;
  weekError: string;
  onWeekFileSelect: (file: File) => void;
  fourWeekFile: File | null;
  fourWeekRows: UsageReportRow[] | null;
  fourWeekError: string;
  onFourWeekFileSelect: (file: File) => void;
  flaggedItems: UsageFlaggedItem[];
  onItemChange: (index: number, updates: Partial<UsageFlaggedItem>) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const formatCurrency = (value: number) =>
    `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const underItems = flaggedItems.filter((item) => item.direction === 'under');
  const overItems = flaggedItems.filter((item) => item.direction === 'over');

  const renderItemRow = (item: UsageFlaggedItem) => {
    const priorThreeWeeks = item.fourWeekVariance === null ? null : item.fourWeekVariance - item.weekVariance;
    const sharePct =
      item.fourWeekVariance === null || item.fourWeekVariance === 0
        ? null
        : Math.round((Math.abs(item.weekVariance) / Math.abs(item.fourWeekVariance)) * 100);
    const trend =
      sharePct === null
        ? item.fourWeekVariance === null
          ? 'No 4-week data'
          : 'No comparable 4-week total'
        : sharePct > 50
        ? `One-off (${sharePct}% of 4-week total occurred this week)`
        : `Trend (${sharePct}% of 4-week total occurred this week)`;

    return (
      <div key={`${item.direction}-${item.itemName}`} className="border border-slate-200 rounded-lg p-4 mt-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="font-medium text-slate-800">{item.itemName}</p>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">Week: {formatCurrency(item.weekVariance)}</span>
            <span className="text-slate-600">
              4-Week: {item.fourWeekVariance === null ? 'N/A' : formatCurrency(item.fourWeekVariance)}
            </span>
            <span className="text-slate-600">
              Prior 3 Weeks: {priorThreeWeeks === null ? 'N/A' : formatCurrency(priorThreeWeeks)}
            </span>
            <span className="text-slate-500">{trend}</span>
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={item.confirmed}
            onChange={(e) => onItemChange(flaggedItems.indexOf(item), { confirmed: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-500"
          />
          Reviewed and confirmed
        </label>
        <textarea
          value={item.comment}
          onChange={(e) => onItemChange(flaggedItems.indexOf(item), { comment: e.target.value })}
          placeholder="Comment (e.g. count error, missed invoice, waste, portioning issue)"
          className="mt-2 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          rows={2}
        />
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.usageReview} />

      <div className="mt-4">
        <h3 className="text-base font-semibold text-slate-800">Run the Reports</h3>
        <ul className="mt-2 space-y-1 list-disc list-inside text-sm text-slate-600">
          <li>OC &gt; Reports &gt; Usage Summary - Top 25 / Bottom 10 &gt; Select Date Range &gt; Category: Food &gt; Run Report &gt; Save to CSV.</li>
          <li>Run it twice: once for the reporting week, once for the trailing 4 weeks.</li>
        </ul>
      </div>

      <UsageReportUploadZone
        title="1. Upload Reporting Week Report"
        instructions="Select the reporting week's date range, then upload the saved CSV."
        file={weekFile}
        rowCount={weekRows ? weekRows.length : null}
        error={weekError}
        onFileSelect={onWeekFileSelect}
      />

      <UsageReportUploadZone
        title="2. Upload Trailing 4-Week Report"
        instructions="Select a date range covering the trailing 4 weeks, including the reporting week, then upload the saved CSV."
        file={fourWeekFile}
        rowCount={fourWeekRows ? fourWeekRows.length : null}
        error={fourWeekError}
        onFileSelect={onFourWeekFileSelect}
      />

      {flaggedItems.length > 0 && (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-slate-800">3. Review Flagged Items</h3>

          <p className="mt-2 text-sm font-medium text-slate-700">Under-Used (potential count errors or missed invoices)</p>
          {underItems.map((item) => renderItemRow(item))}

          <p className="mt-6 text-sm font-medium text-slate-700">Over-Used (potential operational or count issues)</p>
          {overItems.map((item) => renderItemRow(item))}
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
          onClick={onFinish}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function GuidedFinalFoodCostStep({
  file,
  summary,
  error,
  onFileSelect,
  onFieldsChange,
  onBack,
  onFinish,
}: {
  file: File | null;
  summary: FoodCostSummary | null;
  error: string;
  onFileSelect: (file: File) => void;
  onFieldsChange?: (updates: GuidedFieldUpdates) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    onFieldsChange?.({ food_sales_oc: summary?.foodSalesOC ?? 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary]);

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const formatCurrency = (value: number) =>
    `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatPct = (value: number) => `${value.toFixed(2)}%`;

  const totals = summary
    ? summary.categories.reduce(
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
      )
    : null;

  const pctOfPushSales = (value: number) =>
    summary && summary.pushSales !== 0 ? (value / summary.pushSales) * 100 : 0;

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.finalFoodCost} />

      <div className="mt-4">
        <h3 className="text-base font-semibold text-slate-800">Run the Report</h3>
        <ul className="mt-2 space-y-1 list-disc list-inside text-sm text-slate-600">
          <li>OC &gt; Reports &gt; Usage Summary - Group Totals &gt; Select Date Range &gt; Category: Food &gt; Run Report &gt; Save to CSV.</li>
          <li>Usage is recomputed using your GL purchase totals from the Purchases step, not this report's own purchase figures.</li>
        </ul>
      </div>

      <div className="mt-6">
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
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? 'border-slate-800 bg-slate-50' : 'border-slate-300'
          }`}
        >
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-3">Drag and drop your report here, or</p>
          <label className="inline-block px-4 py-2 rounded-lg bg-slate-800 text-white cursor-pointer hover:bg-slate-700 transition-colors">
            Browse Files
            <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          </label>
        </div>

        {file && !error && summary && (
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

        {summary && (
          <>
            <div className="mt-4 inline-flex items-baseline gap-2 bg-slate-800 text-white rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-slate-300">Actual Total Food Cost:</span>
              <span className="text-lg font-semibold">{totals ? formatCurrency(totals.actualUsage) : '—'}</span>
              {totals && (
                <span className="text-sm text-slate-300">({formatPct(pctOfPushSales(totals.actualUsage))})</span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-3">
              <div className="inline-flex items-baseline gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-slate-500">Food Sales (Push):</span>
                <span className="text-lg font-semibold text-slate-800">{formatCurrency(summary.pushSales)}</span>
              </div>
              <div className="inline-flex items-baseline gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-slate-500">Food Sales (OC):</span>
                <span className="text-lg font-semibold text-slate-800">{formatCurrency(summary.foodSalesOC)}</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Percentages below are calculated against Food Sales (Push).
            </p>

            <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Category</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">Opening</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">GL Purchases</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">Closing</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">Waste</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">Actual Usage</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">Ideal Usage</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.categories.map((row) => (
                    <tr key={row.category} className="border-t border-slate-200">
                      <td className="px-3 py-2 text-slate-700">{row.category}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(row.opening)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(row.glPurchases)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(row.closing)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {formatCurrency(row.waste)}
                        <div className="text-xs text-slate-400">{formatPct(row.pctWaste)}</div>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {formatCurrency(row.actualUsage)}
                        <div className="text-xs text-slate-400">{formatPct(row.pctActualUsage)}</div>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {formatCurrency(row.idealUsage)}
                        <div className="text-xs text-slate-400">{formatPct(row.pctIdealUsage)}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800">
                        {formatCurrency(row.variance)}
                        <div className="text-xs text-slate-400">{formatPct(row.pctVariance)}</div>
                      </td>
                    </tr>
                  ))}
                  {totals && (
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td className="px-3 py-2 font-semibold text-slate-800">Total</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(totals.opening)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(totals.glPurchases)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(totals.closing)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">
                        {formatCurrency(totals.waste)}
                        <div className="text-xs text-slate-400">{formatPct(pctOfPushSales(totals.waste))}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">
                        {formatCurrency(totals.actualUsage)}
                        <div className="text-xs text-slate-400">{formatPct(pctOfPushSales(totals.actualUsage))}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">
                        {formatCurrency(totals.idealUsage)}
                        <div className="text-xs text-slate-400">{formatPct(pctOfPushSales(totals.idealUsage))}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">
                        {formatCurrency(totals.variance)}
                        <div className="text-xs text-slate-400">{formatPct(pctOfPushSales(totals.variance))}</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
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
          onClick={onFinish}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

type FcapItem = {
  item: string;
  cost: number;
  variancePerDay: number;
  reason: string;
  action: string;
  manager: string;
  teamMembers: string;
  wk1: number;
  wk2: number;
  wk3: number;
  wk4: number;
};

function normalizeFcapItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseFcapPaste(text: string): FcapItem[] {
  const lines = text.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim() !== '');
  const items: FcapItem[] = [];
  const toNumber = (raw: string) => {
    const cleaned = raw.replace(/[$,\s]/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 2) continue;
    const label = cols[0].trim();
    if (!label || /^total/i.test(label) || /^top 10/i.test(label) || /variance including waste/i.test(label)) {
      continue;
    }
    items.push({
      item: label,
      cost: toNumber(cols[1] ?? ''),
      variancePerDay: toNumber(cols[2] ?? ''),
      reason: (cols[3] ?? '').trim(),
      action: (cols[4] ?? '').trim(),
      manager: (cols[5] ?? '').trim(),
      teamMembers: (cols[6] ?? '').trim(),
      wk1: toNumber(cols[7] ?? ''),
      wk2: toNumber(cols[8] ?? ''),
      wk3: toNumber(cols[9] ?? ''),
      wk4: toNumber(cols[10] ?? ''),
    });
  }

  return items;
}

function GuidedFinalFoodCostRecapStep({
  summary,
  usageWeekRows,
  locationName,
  comments,
  onCommentsChange,
  onFieldsChange,
  locationId,
  fiscalYear,
  periodNumber,
  weekNumber,
  onBack,
  onFinish,
}: {
  summary: FoodCostSummary | null;
  usageWeekRows: UsageReportRow[] | null;
  locationName?: string;
  comments: string;
  onCommentsChange: (value: string) => void;
  onFieldsChange?: (updates: GuidedFieldUpdates) => void;
  locationId?: string;
  fiscalYear?: number;
  periodNumber?: number;
  weekNumber?: number;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [baseline, setBaseline] = useState<FoodCostPlBaseline | null>(null);
  const [weeksRemainingInYear, setWeeksRemainingInYear] = useState(0);
  const [loadingPL, setLoadingPL] = useState(false);
  const [plError, setPlError] = useState('');

  const [fcapItems, setFcapItems] = useState<FcapItem[]>([]);
  const [fcapPasteText, setFcapPasteText] = useState('');
  const [fcapId, setFcapId] = useState<string | null>(null);
  const [fcapLoading, setFcapLoading] = useState(false);
  const [fcapSaving, setFcapSaving] = useState(false);
  const [fcapSavedAt, setFcapSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId || !fiscalYear || !periodNumber || !weekNumber) return;

    let cancelled = false;
    setLoadingPL(true);
    setPlError('');

    Promise.all([
      fetchFoodCostPlBaseline(locationId, fiscalYear, periodNumber, weekNumber),
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

  useEffect(() => {
    if (!locationId || !fiscalYear || !periodNumber) return;

    let cancelled = false;
    setFcapLoading(true);

    supabase
      .from('food_cost_action_plans')
      .select('id, items, updated_at')
      .eq('location_id', locationId)
      .eq('fiscal_year', fiscalYear)
      .eq('period_number', periodNumber)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setFcapId(data.id);
        setFcapItems(Array.isArray(data.items) ? data.items : []);
        setFcapSavedAt(data.updated_at ?? null);
      })
      .finally(() => {
        if (!cancelled) setFcapLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locationId, fiscalYear, periodNumber]);

  const currentWeekKey = (`wk${Math.min(Math.max(weekNumber ?? 1, 1), 4)}`) as 'wk1' | 'wk2' | 'wk3' | 'wk4';

  useEffect(() => {
    if (!usageWeekRows || usageWeekRows.length === 0) return;

    const varianceByName = new Map(
      usageWeekRows.map((row) => [normalizeFcapItemName(row.itemName), row.varianceAmount])
    );

    setFcapItems((prev) => {
      let changed = false;
      const next = prev.map((it) => {
        const match = varianceByName.get(normalizeFcapItemName(it.item));
        if (match === undefined || it[currentWeekKey] === match) return it;
        changed = true;
        return { ...it, [currentWeekKey]: match };
      });
      return changed ? next : prev;
    });
  }, [usageWeekRows, fcapItems.length, currentWeekKey]);

  const handleImportPaste = () => {
    const parsed = parseFcapPaste(fcapPasteText);
    if (parsed.length > 0) {
      setFcapItems(parsed);
      setFcapPasteText('');
    }
  };

  const handleItemChange = (index: number, field: keyof FcapItem, value: string) => {
    setFcapItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const isNumeric = field === 'cost' || field === 'variancePerDay' || field === 'wk1' || field === 'wk2' || field === 'wk3' || field === 'wk4';
        return { ...it, [field]: isNumeric ? parseFloat(value) || 0 : value };
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    setFcapItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveFcap = async () => {
    if (!locationId || !fiscalYear || !periodNumber) return;
    setFcapSaving(true);
    try {
      const { data, error: saveError } = await supabase
        .from('food_cost_action_plans')
        .upsert(
          {
            id: fcapId ?? undefined,
            location_id: locationId,
            fiscal_year: fiscalYear,
            period_number: periodNumber,
            items: fcapItems,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'location_id,fiscal_year,period_number' }
        )
        .select('id, updated_at')
        .single();

      if (!saveError && data) {
        setFcapId(data.id);
        setFcapSavedAt(data.updated_at ?? null);
      }
    } finally {
      setFcapSaving(false);
    }
  };

  const handleExportFcap = () => {
    const headers = ['Item', 'Cost', 'Variance Per Day', 'Reason For Variance', 'Action to Reduce Variance', 'Manager Responsible', 'Team Members', 'WK1', 'WK2', 'WK3', 'WK4', 'Total', 'PTD Difference'];
    const rows = fcapItems.map((it) => {
      const total = it.wk1 + it.wk2 + it.wk3 + it.wk4;
      const ptdDifference = total - it.cost;
      return [it.item, it.cost, it.variancePerDay, it.reason, it.action, it.manager, it.teamMembers, it.wk1, it.wk2, it.wk3, it.wk4, total, ptdDifference];
    });
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'FCAP');
    XLSX.writeFile(workbook, `FCAP_${fiscalYear ?? ''}_P${periodNumber ?? ''}.xlsx`);
  };

  const handleExportFcapPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const fmt = (value: number) =>
      `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Food Cost Action Plan', pageWidth / 2, 36, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const subtitle = [locationName, fiscalYear ? `Fiscal Year ${fiscalYear}` : '', periodNumber ? `Period ${periodNumber}` : '']
      .filter(Boolean)
      .join('   •   ');
    doc.text(subtitle, pageWidth / 2, 54, { align: 'center' });

    autoTable(doc, {
      startY: 70,
      head: [['', 'Week to Date', 'Period to Date', 'Year to Date']],
      body: [
        ['Actual %', formatPct(wtdPct), formatPct(ptdPct), formatPct(ytdPct)],
        ['Budget %', formatPct(wtdBudgetPct), baseline ? formatPct(baseline.periodBudgetPct) : '—', baseline ? formatPct(baseline.ytdBudgetPct) : '—'],
        [
          'Variance',
          `${wtdVariance > 0 ? '+' : ''}${formatPct(wtdVariance)}`,
          `${ptdVarAmount > 0 ? '+' : ''}${fmt(ptdVarAmount)}`,
          `${ytdVarAmount > 0 ? '+' : ''}${fmt(ytdVarAmount)}`,
        ],
      ],
      styles: { fontSize: 9, cellPadding: 6, halign: 'center' },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { fontStyle: 'bold', halign: 'left' } },
      margin: { left: 30, right: 30 },
      tableWidth: pageWidth - 60,
    });

    const ntsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

    if (ytdVarAmount > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 60, 0);
      doc.text(
        `Need to Save (Year to Date): ${fmt(ytdVarAmount)} over budget across ${safeWeeksRemaining} week${safeWeeksRemaining === 1 ? '' : 's'} remaining — ${fmt(needToSavePerWeek)}/week, ${fmt(needToSavePerDay)}/day`,
        30,
        ntsY
      );
      doc.setTextColor(0);
    }

    const rows = fcapItems.map((it) => {
      const total = it.wk1 + it.wk2 + it.wk3 + it.wk4;
      const ptdDifference = total - it.cost;
      return [
        it.item,
        fmt(it.cost),
        fmt(it.variancePerDay),
        it.reason,
        it.action,
        it.manager,
        it.teamMembers,
        fmt(it.wk1),
        fmt(it.wk2),
        fmt(it.wk3),
        fmt(it.wk4),
        fmt(total),
        fmt(ptdDifference),
      ];
    });

    const totalsRow = [
      'TOTALS',
      fmt(fcapTotals.cost),
      fmt(fcapTotals.variancePerDay),
      '',
      '',
      '',
      '',
      fmt(fcapTotals.wk1),
      fmt(fcapTotals.wk2),
      fmt(fcapTotals.wk3),
      fmt(fcapTotals.wk4),
      fmt(fcapTotals.total),
      fmt(fcapTotals.ptdDifference),
    ];

    autoTable(doc, {
      startY: ytdVarAmount > 0 ? ntsY + 12 : ntsY,
      head: [['Item', 'Cost', 'Var/Day', 'Reason', 'Action', 'Manager', 'Team Members', 'WK1', 'WK2', 'WK3', 'WK4', 'Total', 'PTD Diff']],
      body: rows,
      foot: [totalsRow],
      styles: { fontSize: 8, cellPadding: 5, valign: 'middle' },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 90 },
        3: { cellWidth: 100 },
        4: { cellWidth: 110 },
      },
      margin: { left: 30, right: 30 },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generated ${new Date().toLocaleDateString()}`, 30, finalY + 20);

    doc.save(`FCAP_${fiscalYear ?? ''}_P${periodNumber ?? ''}.pdf`);
  };

  const formatCurrency = (value: number) =>
    `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatPct = (value: number) => `${value.toFixed(2)}%`;

  const totals = summary
    ? summary.categories.reduce(
        (acc, c) => ({
          actualUsage: acc.actualUsage + c.actualUsage,
        }),
        { actualUsage: 0 }
      )
    : null;

  const pctOfPushSales = (value: number) =>
    summary && summary.pushSales !== 0 ? (value / summary.pushSales) * 100 : 0;

  const wtdActualUsage = totals?.actualUsage ?? 0;
  const wtdSales = summary?.pushSales ?? 0;
  const wtdPct = pctOfPushSales(wtdActualUsage);
  const wtdBudgetPct = baseline?.periodBudgetPct ?? 0;
  const wtdVariance = wtdPct - wtdBudgetPct;

  const ptdFoodCost = baseline ? (baseline.isCurrentWeek ? baseline.periodFoodCostActual : baseline.periodFoodCostActual + wtdActualUsage) : 0;
  const ptdSales = baseline ? (baseline.isCurrentWeek ? baseline.periodSalesActual : baseline.periodSalesActual + wtdSales) : 0;
  const ptdPct = ptdSales > 0 ? (ptdFoodCost / ptdSales) * 100 : 0;
  const ptdVarAmount = baseline ? ((ptdPct - baseline.periodBudgetPct) / 100) * ptdSales : 0;

  const ytdFoodCost = baseline ? (baseline.isCurrentWeek ? baseline.ytdFoodCostActual : baseline.ytdFoodCostActual + wtdActualUsage) : 0;
  const ytdSales = baseline ? (baseline.isCurrentWeek ? baseline.ytdSalesActual : baseline.ytdSalesActual + wtdSales) : 0;
  const ytdPct = ytdSales > 0 ? (ytdFoodCost / ytdSales) * 100 : 0;
  const ytdVarAmount = baseline ? ((ytdPct - baseline.ytdBudgetPct) / 100) * ytdSales : 0;

  const safeWeeksRemaining = Math.max(weeksRemainingInYear, 1);
  const needToSavePerWeek = ytdVarAmount > 0 ? ytdVarAmount / safeWeeksRemaining : 0;
  const needToSavePerDay = needToSavePerWeek / 7;

  useEffect(() => {
    onFieldsChange?.({
      fc_need_save_per_week: parseFloat(needToSavePerWeek.toFixed(2)),
      fc_need_save_per_day: parseFloat(needToSavePerDay.toFixed(2)),
      recap_fc_wtd_pct: parseFloat(wtdPct.toFixed(2)),
      recap_fc_ptd_pct: parseFloat(ptdPct.toFixed(2)),
      recap_fc_ytd_pct: parseFloat(ytdPct.toFixed(2)),
      recap_fc_ytd_budget_pct: parseFloat((baseline?.ytdBudgetPct ?? 0).toFixed(2)),
      recap_fc_ytd_variance_amount: parseFloat(ytdVarAmount.toFixed(2)),
    });
  }, [needToSavePerWeek, needToSavePerDay, wtdPct, ptdPct, ytdPct, ytdVarAmount, baseline]);

  const varianceClass = (value: number) =>
    value <= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700';

  const fcapTotals = fcapItems.reduce(
    (acc, it) => {
      const total = it.wk1 + it.wk2 + it.wk3 + it.wk4;
      return {
        cost: acc.cost + it.cost,
        variancePerDay: acc.variancePerDay + it.variancePerDay,
        wk1: acc.wk1 + it.wk1,
        wk2: acc.wk2 + it.wk2,
        wk3: acc.wk3 + it.wk3,
        wk4: acc.wk4 + it.wk4,
        total: acc.total + total,
        ptdDifference: acc.ptdDifference + (total - it.cost),
      };
    },
    { cost: 0, variancePerDay: 0, wk1: 0, wk2: 0, wk3: 0, wk4: 0, total: 0, ptdDifference: 0 }
  );

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.finalFoodCostRecap} />

      {loadingPL && (
        <p className="mt-4 text-sm text-slate-500">Loading P&L data...</p>
      )}

      {plError && !loadingPL && (
        <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          {plError}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {ytdVarAmount > 0 && (
        <div className="mt-6 border rounded-lg p-4 border-blue-200 bg-blue-50">
          <p className="text-xs font-medium uppercase text-blue-700">
            Need to Save — Food Cost (Year to Date)
          </p>
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
        </div>
      )}

      <div className="mt-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">Chef Comment</label>
        <textarea
          value={comments}
          onChange={(e) => onCommentsChange(e.target.value)}
          rows={3}
          placeholder="Comment on food cost performance — trends, drivers, or corrective action."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
        />
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="text-base font-semibold text-slate-800">Food Cost Action Plan (FCAP)</h3>
        <p className="mt-1 text-sm text-slate-600">
          Paste the Top 10 items from the "Total Variance Including Waste - Period End" report (copied directly from
          Excel) below. Once a plan is created, it carries through all 4 weeks of the period — just update each
          item's weekly progress as you go.
        </p>
        {fcapLoading && <p className="mt-2 text-xs text-slate-500">Loading existing plan...</p>}
        {fcapSavedAt && (
          <p className="mt-2 text-xs text-slate-400">Last saved {new Date(fcapSavedAt).toLocaleString()}</p>
        )}

        <div className="mt-4">
          <textarea
            value={fcapPasteText}
            onChange={(e) => setFcapPasteText(e.target.value)}
            rows={4}
            placeholder="Paste tab-separated rows here (Item, Cost, Variance Per Day, Reason, Action, Manager, Team Members, WK1-WK4)..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 font-mono text-xs"
          />
          <button
            onClick={handleImportPaste}
            disabled={!fcapPasteText.trim()}
            className="mt-2 px-4 py-2 bg-slate-800 text-white rounded-lg font-medium text-sm hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Import Pasted Data
          </button>
        </div>

        {fcapItems.length > 0 && (
          <>
            {usageWeekRows && usageWeekRows.length > 0 && (
              <p className="mt-4 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                {currentWeekKey.toUpperCase()} values below were auto-filled from this week's Usage Report where item
                names match exactly. Adjust any value manually if needed.
              </p>
            )}
            <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Item</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">Cost</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">Var/Day</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Reason</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Action</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Manager</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Team Members</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">WK1</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">WK2</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">WK3</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">WK4</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">Total</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">PTD Diff</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {fcapItems.map((it, index) => {
                    const total = it.wk1 + it.wk2 + it.wk3 + it.wk4;
                    const ptdDifference = total - it.cost;
                    return (
                      <tr key={index} className="border-t border-slate-200">
                        <td className="px-3 py-2">
                          <input
                            value={it.item}
                            onChange={(e) => handleItemChange(index, 'item', e.target.value)}
                            className="w-full min-w-[100px] px-2 py-1 border border-slate-200 rounded text-slate-700"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(it.cost)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(it.variancePerDay)}</td>
                        <td className="px-3 py-2">
                          <input
                            value={it.reason}
                            onChange={(e) => handleItemChange(index, 'reason', e.target.value)}
                            className="w-full min-w-[140px] px-2 py-1 border border-slate-200 rounded text-slate-700"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={it.action}
                            onChange={(e) => handleItemChange(index, 'action', e.target.value)}
                            className="w-full min-w-[140px] px-2 py-1 border border-slate-200 rounded text-slate-700"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={it.manager}
                            onChange={(e) => handleItemChange(index, 'manager', e.target.value)}
                            className="w-full min-w-[90px] px-2 py-1 border border-slate-200 rounded text-slate-700"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={it.teamMembers}
                            onChange={(e) => handleItemChange(index, 'teamMembers', e.target.value)}
                            className="w-full min-w-[100px] px-2 py-1 border border-slate-200 rounded text-slate-700"
                          />
                        </td>
                        {(['wk1', 'wk2', 'wk3', 'wk4'] as const).map((wk) => (
                          <td key={wk} className="px-3 py-2">
                            <input
                              type="number"
                              value={it[wk]}
                              onChange={(e) => handleItemChange(index, wk, e.target.value)}
                              className="w-20 px-2 py-1 border border-slate-200 rounded text-right text-slate-700"
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-medium text-slate-800">{formatCurrency(total)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${ptdDifference <= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCurrency(ptdDifference)}
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => handleRemoveItem(index)} className="text-slate-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-800">
                    <td className="px-3 py-2">TOTALS</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(fcapTotals.cost)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(fcapTotals.variancePerDay)}</td>
                    <td className="px-3 py-2" colSpan={4}></td>
                    <td className="px-3 py-2 text-right">{formatCurrency(fcapTotals.wk1)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(fcapTotals.wk2)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(fcapTotals.wk3)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(fcapTotals.wk4)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(fcapTotals.total)}</td>
                    <td className={`px-3 py-2 text-right ${fcapTotals.ptdDifference <= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatCurrency(fcapTotals.ptdDifference)}
                    </td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={handleSaveFcap}
                disabled={fcapSaving || !locationId || !fiscalYear || !periodNumber}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium text-sm hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {fcapSaving ? 'Saving...' : 'Save Plan'}
              </button>
              <button
                onClick={handleExportFcap}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors"
              >
                Export to Excel
              </button>
              <button
                onClick={handleExportFcapPdf}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors"
              >
                Export to PDF (Kitchen Posting)
              </button>
            </div>
          </>
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
          onClick={onFinish}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
        >
          Finish
        </button>
      </div>
    </div>
  );
}

type StaffingField =
  | 'idealCooks'
  | 'currentCooks'
  | 'idealPrep'
  | 'currentPrep'
  | 'idealDish'
  | 'currentDish'
  | 'idealOther'
  | 'currentOther';

function GuidedTeamStep({
  idealCooks,
  currentCooks,
  idealPrep,
  currentPrep,
  idealDish,
  currentDish,
  idealOther,
  currentOther,
  onStaffingChange,
  hiringNotes,
  onHiringNotesChange,
  tmMotsOfNote,
  onTmMotsOfNoteChange,
  developmentPathUpdates,
  onDevelopmentPathUpdatesChange,
  onBack,
  onNext,
}: {
  idealCooks: string;
  currentCooks: string;
  idealPrep: string;
  currentPrep: string;
  idealDish: string;
  currentDish: string;
  idealOther: string;
  currentOther: string;
  onStaffingChange: (field: StaffingField, value: string) => void;
  hiringNotes: string;
  onHiringNotesChange: (value: string) => void;
  tmMotsOfNote: string;
  onTmMotsOfNoteChange: (value: string) => void;
  developmentPathUpdates: string;
  onDevelopmentPathUpdatesChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const rows: { label: string; ideal: StaffingField; current: StaffingField; idealValue: string; currentValue: string }[] = [
    { label: 'Cooks', ideal: 'idealCooks', current: 'currentCooks', idealValue: idealCooks, currentValue: currentCooks },
    { label: 'Prep', ideal: 'idealPrep', current: 'currentPrep', idealValue: idealPrep, currentValue: currentPrep },
    { label: 'Dish', ideal: 'idealDish', current: 'currentDish', idealValue: idealDish, currentValue: currentDish },
    { label: 'Other', ideal: 'idealOther', current: 'currentOther', idealValue: idealOther, currentValue: currentOther },
  ];

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.team} />

      <div className="mt-6 space-y-3">
        <h3 className="text-base font-semibold text-slate-800">Team Staffing</h3>
        <div className="grid grid-cols-4 gap-4 font-medium text-slate-700 text-sm pb-1 border-b border-slate-100">
          <div>Position</div>
          <div>Ideal #</div>
          <div>Current #</div>
          <div>Needed</div>
        </div>
        {rows.map(({ label, ideal, current, idealValue, currentValue }) => {
          const needed = (parseInt(idealValue) || 0) - (parseInt(currentValue) || 0);
          return (
            <div key={label} className="grid grid-cols-4 gap-4 items-center">
              <div className="text-sm font-medium text-slate-700">{label}</div>
              <input
                type="number"
                value={idealValue}
                onChange={(e) => onStaffingChange(ideal, e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <input
                type="number"
                value={currentValue}
                onChange={(e) => onStaffingChange(current, e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className={`px-3 py-2 border rounded-lg font-medium text-sm ${needed > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : needed < 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                {needed > 0 ? `+${needed} needed` : needed < 0 ? `${Math.abs(needed)} over` : 'Fully staffed'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Hiring Notes</label>
          <textarea
            value={hiringNotes}
            onChange={(e) => onHiringNotesChange(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">TM MOTs of Note</label>
          <textarea
            value={tmMotsOfNote}
            onChange={(e) => onTmMotsOfNoteChange(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Development Path Updates</label>
          <textarea
            value={developmentPathUpdates}
            onChange={(e) => onDevelopmentPathUpdatesChange(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          />
        </div>
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

function GuidedFacilitiesStep({
  rmIssues,
  onRmIssuesChange,
  cleaningFocus,
  onCleaningFocusChange,
  onBack,
  onNext,
}: {
  rmIssues: string;
  onRmIssuesChange: (value: string) => void;
  cleaningFocus: string;
  onCleaningFocusChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.facilities} />

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">R&M Issues</label>
          <textarea
            value={rmIssues}
            onChange={(e) => onRmIssuesChange(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cleaning Focus</label>
          <textarea
            value={cleaningFocus}
            onChange={(e) => onCleaningFocusChange(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          />
        </div>
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

function GuidedFeaturesStep({
  items,
  onItemsChange,
  notes,
  onNotesChange,
  onBack,
  onNext,
}: {
  items: FeatureItem[];
  onItemsChange: (items: FeatureItem[]) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const updateItem = (index: number, field: keyof FeatureItem, value: string | number) => {
    const next = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    onItemsChange(next);
  };

  const addItem = () => onItemsChange([...items, { name: '', sold: 0, notes: '' }]);
  const removeItem = (index: number) => onItemsChange(items.filter((_, i) => i !== index));

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.features} />

      <div className="mt-6 space-y-4">
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-4">
              <input
                type="text"
                placeholder="Feature name"
                value={item.name}
                onChange={(e) => updateItem(index, 'name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div className="md:col-span-2">
              <input
                type="number"
                placeholder="Sold"
                value={item.sold || ''}
                onChange={(e) => updateItem(index, 'sold', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="md:col-span-5">
              <input
                type="text"
                placeholder="Notes"
                value={item.notes}
                onChange={(e) => updateItem(index, 'notes', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div className="md:col-span-1">
              <button
                onClick={() => removeItem(index)}
                className="w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={addItem}
          className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Feature Item
        </button>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Feature Notes</label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          />
        </div>
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

function GuidedAuditStep({
  score,
  onScoreChange,
  priorScore,
  loadingPriorScore,
  comment,
  onCommentChange,
  onBack,
  onNext,
}: {
  score: string;
  onScoreChange: (value: string) => void;
  priorScore: number | null;
  loadingPriorScore: boolean;
  comment: string;
  onCommentChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.audit} />

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Last Audit Score (%)</label>
          {loadingPriorScore && (
            <p className="text-xs text-slate-400 mb-1">Loading prior score...</p>
          )}
          {!loadingPriorScore && priorScore !== null && (
            <p className="text-xs text-slate-400 mb-1">Auto-populated from last audit score on file: {priorScore}%</p>
          )}
          <input
            type="number"
            value={score}
            onChange={(e) => onScoreChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Audit Score Comment</label>
          <textarea
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          />
        </div>
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

function GuidedRecapStep({
  locationName,
  locationId,
  fiscalYear,
  periodNumber,
  weekNumber,
  foodCostComments,
  labourReviewActionPlan,
  salesActionPlan,
  hiringNotes,
  tmMotsOfNote,
  developmentPathUpdates,
  rmIssues,
  cleaningFocus,
  featureItems,
  featuresNotes,
  auditScore,
  auditScoreComment,
  aiSummary,
  onAiSummaryChange,
  onGenerate,
  generating,
  error,
  recapMetrics,
  foodCostSummary,
  onBack,
  onFinish,
}: {
  locationName?: string;
  locationId?: string;
  fiscalYear?: number;
  periodNumber?: number;
  weekNumber?: number;
  foodCostComments: string;
  labourReviewActionPlan: string;
  salesActionPlan: string;
  hiringNotes: string;
  tmMotsOfNote: string;
  developmentPathUpdates: string;
  rmIssues: string;
  cleaningFocus: string;
  featureItems: FeatureItem[];
  featuresNotes: string;
  auditScore: string;
  auditScoreComment: string;
  aiSummary: string;
  onAiSummaryChange: (value: string) => void;
  onGenerate: () => void;
  generating: boolean;
  error: string;
  recapMetrics: GuidedFieldUpdates;
  foodCostSummary: FoodCostSummary | null;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');

  // Actions for the Week Ahead — committed forward actions, persisted to weekly_actions.
  const [weekAheadActions, setWeekAheadActions] = useState<EditableAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [draftingActions, setDraftingActions] = useState(false);
  const [actionsError, setActionsError] = useState('');
  const [savingActions, setSavingActions] = useState(false);
  const [actionsSavedAt, setActionsSavedAt] = useState<string | null>(null);

  // Food Cost Action Plan items, loaded so they can be folded into the PDF export.
  const [fcapItems, setFcapItems] = useState<FcapRow[]>([]);

  // Load any actions already committed for this week (so the step is resumable).
  useEffect(() => {
    if (!locationId || !fiscalYear || !periodNumber || !weekNumber) return;

    let cancelled = false;
    setActionsLoading(true);

    supabase
      .from('weekly_actions')
      .select('id, action_text, owner, due_by, source_section, sort_order, updated_at')
      .eq('location_id', locationId)
      .eq('fiscal_year', fiscalYear)
      .eq('period_number', periodNumber)
      .eq('week_number', weekNumber)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data || data.length === 0) return;
        setWeekAheadActions(
          data.map((row) => ({
            id: row.id,
            action_text: row.action_text ?? '',
            owner: row.owner ?? '',
            due_by: row.due_by ?? '',
            source_section: row.source_section ?? 'manual',
          }))
        );
        const latest = data
          .map((r) => r.updated_at)
          .filter(Boolean)
          .sort()
          .pop();
        setActionsSavedAt(latest ?? null);
      })
      .finally(() => {
        if (!cancelled) setActionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locationId, fiscalYear, periodNumber, weekNumber]);

  // Load the shared Food Cost Action Plan (per location/period) for the PDF export.
  useEffect(() => {
    if (!locationId || !fiscalYear || !periodNumber) return;

    let cancelled = false;
    supabase
      .from('food_cost_action_plans')
      .select('items')
      .eq('location_id', locationId)
      .eq('fiscal_year', fiscalYear)
      .eq('period_number', periodNumber)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setFcapItems(Array.isArray(data.items) ? (data.items as FcapRow[]) : []);
      });

    return () => {
      cancelled = true;
    };
  }, [locationId, fiscalYear, periodNumber]);

  const handleAddAction = () => {
    setWeekAheadActions((prev) => [...prev, createBlankAction()]);
  };

  const handleRemoveAction = (id: string) => {
    setWeekAheadActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleActionFieldChange = (id: string, field: keyof EditableAction, value: string) => {
    setWeekAheadActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  const handleDraftActions = async () => {
    setDraftingActions(true);
    setActionsError('');
    try {
      const chefNotes = [
        formatRecapMetricsForPrompt(recapMetrics),
        foodCostComments && `Food Cost Action Plan: ${foodCostComments}`,
        labourReviewActionPlan && `Labour Action Plan: ${labourReviewActionPlan}`,
        salesActionPlan && `Sales Action Plan: ${salesActionPlan}`,
        hiringNotes && `Hiring: ${hiringNotes}`,
        tmMotsOfNote && `Team Members of Note: ${tmMotsOfNote}`,
        developmentPathUpdates && `Development Path: ${developmentPathUpdates}`,
        rmIssues && `R&M Issues: ${rmIssues}`,
        cleaningFocus && `Cleaning Focus: ${cleaningFocus}`,
        featuresNotes && `Features: ${featuresNotes}`,
        auditScoreComment && `Audit: ${auditScoreComment}`,
      ].filter(Boolean).join('\n');

      if (!chefNotes.trim()) {
        setActionsError('Add some notes in the earlier steps first, then draft actions.');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-chef-summary`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voice: 'actions',
          summaries: [
            {
              id: 'current',
              location_name: locationName ?? '',
              food_cost_summary: foodCostComments,
              labour_summary: labourReviewActionPlan,
              boh_promo_summary: salesActionPlan,
              notes: chefNotes,
              action_plan_summary: salesActionPlan,
              hiring_notes: hiringNotes,
              tm_mots_of_note: tmMotsOfNote,
              development_path_updates: developmentPathUpdates,
              rm_issues: rmIssues,
              cleaning_focus: cleaningFocus,
              features_notes: featuresNotes,
              audit_score_comment: auditScoreComment,
            },
          ],
        }),
      });

      if (!response.ok) throw new Error('Failed to draft actions');

      const { results } = await response.json();
      const raw = (results?.[0]?.ai_summary ?? '') as string;
      const drafted = raw
        .split('\n')
        .map((line) => line.replace(/^\s*[-*•\d.)]+\s*/, '').trim())
        .filter(Boolean)
        .map((text) => ({ ...createBlankAction('ai'), action_text: text }));

      if (drafted.length === 0) {
        setActionsError('No actions could be drafted from this week’s notes.');
        return;
      }

      // Append drafted actions to whatever the chef has already entered.
      setWeekAheadActions((prev) => [...prev.filter((a) => a.action_text.trim()), ...drafted]);
    } catch (err) {
      setActionsError(err instanceof Error ? err.message : 'Failed to draft actions.');
    } finally {
      setDraftingActions(false);
    }
  };

  // Persist the current actions for this week: clear existing rows then insert.
  const saveWeekAheadActions = async (): Promise<boolean> => {
    if (!locationId || !fiscalYear || !periodNumber || !weekNumber) return false;
    const rows = weekAheadActions
      .filter((a) => a.action_text.trim())
      .map((a, index) => ({
        location_id: locationId,
        fiscal_year: fiscalYear,
        period_number: periodNumber,
        week_number: weekNumber,
        action_text: a.action_text.trim(),
        owner: a.owner.trim(),
        due_by: a.due_by.trim(),
        source_section: a.source_section || 'manual',
        status: 'open',
        sort_order: index,
        updated_at: new Date().toISOString(),
      }));

    const { error: deleteError } = await supabase
      .from('weekly_actions')
      .delete()
      .eq('location_id', locationId)
      .eq('fiscal_year', fiscalYear)
      .eq('period_number', periodNumber)
      .eq('week_number', weekNumber);
    if (deleteError) return false;

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('weekly_actions').insert(rows);
      if (insertError) return false;
    }
    return true;
  };

  const handleSaveActions = async () => {
    setSavingActions(true);
    setActionsError('');
    try {
      const ok = await saveWeekAheadActions();
      if (ok) {
        setActionsSavedAt(new Date().toISOString());
      } else {
        setActionsError('Failed to save actions.');
      }
    } finally {
      setSavingActions(false);
    }
  };

  const handleFinish = async () => {
    // Make sure committed actions are saved before leaving the guide.
    await saveWeekAheadActions();
    onFinish();
  };

  const handleExportFullSummaryPdf = async () => {
    setExportingPdf(true);
    setPdfError('');
    try {
      const chefNotes = [
        formatRecapMetricsForPrompt(recapMetrics),
        foodCostComments && `Food Cost Action Plan: ${foodCostComments}`,
        labourReviewActionPlan && `Labour Action Plan: ${labourReviewActionPlan}`,
        salesActionPlan && `Sales Action Plan: ${salesActionPlan}`,
        hiringNotes && `Hiring: ${hiringNotes}`,
        tmMotsOfNote && `Team Members of Note: ${tmMotsOfNote}`,
        developmentPathUpdates && `Development Path: ${developmentPathUpdates}`,
        rmIssues && `R&M Issues: ${rmIssues}`,
        cleaningFocus && `Cleaning Focus: ${cleaningFocus}`,
        featuresNotes && `Features: ${featuresNotes}`,
        auditScoreComment && `Audit: ${auditScoreComment}`,
      ].filter(Boolean).join('\n');

      let narrative = aiSummary;
      if (chefNotes.trim()) {
        try {
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-chef-summary`;
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              voice: 'chef',
              summaries: [
                {
                  id: 'current',
                  location_name: locationName ?? '',
                  food_cost_summary: foodCostComments,
                  labour_summary: labourReviewActionPlan,
                  boh_promo_summary: salesActionPlan,
                  notes: chefNotes,
                  action_plan_summary: salesActionPlan,
                  hiring_notes: hiringNotes,
                  tm_mots_of_note: tmMotsOfNote,
                  development_path_updates: developmentPathUpdates,
                  rm_issues: rmIssues,
                  cleaning_focus: cleaningFocus,
                  features_notes: featuresNotes,
                  audit_score_comment: auditScoreComment,
                },
              ],
            }),
          });
          if (response.ok) {
            const { results } = await response.json();
            narrative = results?.[0]?.ai_summary ?? aiSummary;
          }
        } catch {
          // fall back to the existing summary if the chef-voice rewrite fails
        }
      }

      const m = recapMetrics;
      const foodSalesPush = m.food_sales_labour_push ?? m.recap_sales_wtd_actual ?? 0;
      const foodSalesOC = m.food_sales_oc ?? 0;
      const labourSpent = m.labour_spent ?? 0;
      const usageAmount = m.usage_amount ?? 0;
      const idealUsageAmount = m.ideal_usage_amount ?? 0;
      // Source the food-cost and labour budget %s from the P&L baseline — the same
      // place the guided final-food-cost step reads them. Without this the export
      // would show a 0% budget and a meaningless +0.00pt variance.
      let budgetFoodCostPct = 0;
      let labourBudgetPct = m.labour_budget_pct ?? 0;
      let baselineWeekEndingDate: string | undefined;
      if (locationId && fiscalYear && periodNumber && weekNumber) {
        try {
          const [fcBaseline, labourBaseline] = await Promise.all([
            fetchFoodCostPlBaseline(locationId, fiscalYear, periodNumber, weekNumber),
            fetchLabourPlBaseline(locationId, fiscalYear, periodNumber, weekNumber),
          ]);
          budgetFoodCostPct = fcBaseline?.periodBudgetPct ?? 0;
          baselineWeekEndingDate = fcBaseline?.weekEndingDate;
          // Fall back to the labour baseline only when the chef left the field blank.
          if (!labourBudgetPct) labourBudgetPct = labourBaseline?.periodBudgetPct ?? 0;
        } catch {
          // Keep the chef-entered / zero defaults if the baseline can't be loaded.
        }
      }
      const budgetFoodSalesPeriod = m.budget_food_sales_period ?? 0;
      const weekBudget = budgetFoodSalesPeriod > 0 ? budgetFoodSalesPeriod / 4 : 0;
      const actualFoodCostPct = foodSalesPush > 0 ? (usageAmount / foodSalesPush) * 100 : 0;
      const fcVariance = actualFoodCostPct - budgetFoodCostPct;
      const theoreticalFoodCostPct = foodSalesPush > 0 ? (idealUsageAmount / foodSalesPush) * 100 : 0;
      const theoreticalVariance = actualFoodCostPct - theoreticalFoodCostPct;
      const labourCostPct = foodSalesPush > 0 ? (labourSpent / foodSalesPush) * 100 : 0;
      const lcVariance = labourCostPct - labourBudgetPct;

      const exportData = {
        location_id: '',
        week_number: weekNumber ?? 0,
        period_number: periodNumber ?? 0,
        fiscal_year: fiscalYear ?? 0,
        budget_food_cost_pct: budgetFoodCostPct,
        on_hand_amount: m.on_hand_amount ?? 0,
        sage_food_sales_qtd: m.recap_sales_ytd_actual ?? 0,
        sage_fcost_qtd_pct: m.recap_fc_ytd_pct ?? 0,
        food_cost_ptd_pct: m.recap_fc_ptd_pct ?? 0,
        sage_sales_budget_qtd: m.recap_sales_ytd_budget ?? 0,
        sales_ptd_actual: 0,
        fc_qtd_pct: m.recap_fc_ytd_pct ?? 0,
        qtd_variance_pct: 0,
        usage_amount: usageAmount,
        ideal_usage_amount: idealUsageAmount,
        theoretical_fc_ptd_pct: theoreticalFoodCostPct,
        theoretical_fc_qtd_pct: theoreticalFoodCostPct,
        budget_food_cost_qtd_pct: m.recap_fc_ytd_budget_pct ?? 0,
        cogs_qtd: 0,
        food_sales_labour_push: foodSalesPush,
        food_sales_oc: foodSalesOC,
        week_variance_amount: foodSalesPush - foodSalesOC,
        budget_food_sales_period: budgetFoodSalesPeriod,
        qtd_variance_amount: (m.recap_sales_ytd_actual ?? 0) - (m.recap_sales_ytd_budget ?? 0),
        labour_budget_pct: labourBudgetPct,
        sage_labour_budget_qtd_pct: m.recap_labour_ytd_budget_pct ?? 0,
        sage_lcost_qtd_pct: m.recap_labour_ytd_pct ?? 0,
        labour_cost_ptd_pct: m.recap_labour_ptd_pct ?? 0,
        labour_qtd_pct: m.recap_labour_ytd_pct ?? 0,
        lab_ptd_var_amount: 0,
        qtd_labour_variance_pct: 0,
        labour_spent: labourSpent,
        overtime_amount: m.overtime_amount ?? 0,
        lab_qtd_var_amount: m.recap_labour_ytd_variance_amount ?? 0,
        ebidta_budget_period_pct: 0,
        ebidta_ptd_pct: 0,
        ebidta_variance_pct: 0,
        qsr_weekend_lunch_time: '',
        qsr_expo_time: m.qsr_expo_time ?? '',
        window_time: m.window_time,
        teamshare_amount: 0,
        petty_cash: m.cogs_petty_cash_amount ?? 0,
        waste_amount: m.waste_amount ?? 0,
        last_audit_score_pct: auditScore ? parseFloat(auditScore) || 0 : 0,
        boh_promo_amount: m.boh_promo_amount ?? 0,
        promo_ptd: 0,
        promo_qtd: 0,
        sous_vac_days: m.sous_vac_days ?? 0,
        food_cost_summary: foodCostComments,
        labour_summary: labourReviewActionPlan,
        boh_promo_summary: salesActionPlan,
        notes: '',
        action_plan_summary: salesActionPlan,
        sales_action_plan: salesActionPlan,
        rm_issues_cleaning_focus: [rmIssues, cleaningFocus].filter(Boolean).join('\n\n'),
        rm_issues: rmIssues,
        cleaning_focus: cleaningFocus,
        audit_score_comment: auditScoreComment,
        ideal_cooks: m.ideal_cooks ?? 0,
        current_cooks: m.current_cooks ?? 0,
        ideal_prep: m.ideal_prep ?? 0,
        current_prep: m.current_prep ?? 0,
        ideal_dish: m.ideal_dish ?? 0,
        current_dish: m.current_dish ?? 0,
        ideal_other: m.ideal_other ?? 0,
        current_other: m.current_other ?? 0,
        hiring_notes: hiringNotes,
        tm_mots_of_note: tmMotsOfNote,
        development_path_updates: developmentPathUpdates,
        feature_items: featureItems,
        ai_summary: narrative,
      };

      const foodCostCategories = foodCostSummary?.categories.map((c) => ({
        category: c.category,
        opening: c.opening,
        glPurchases: c.glPurchases,
        closing: c.closing,
        waste: c.waste,
        actualUsage: c.actualUsage,
        idealUsage: c.idealUsage,
        variance: c.variance,
      }));

      exportChefSummaryToPdf(
        exportData,
        locationName ?? '',
        weekBudget,
        actualFoodCostPct,
        fcVariance,
        theoreticalFoodCostPct,
        theoreticalVariance,
        labourCostPct,
        lcVariance,
        undefined,
        baselineWeekEndingDate,
        m.recap_sales_wtd_actual,
        m.recap_sales_wtd_budget,
        m.recap_fc_wtd_pct,
        m.recap_labour_wtd_pct,
        foodCostCategories,
        weekAheadActions
          .filter((a) => a.action_text.trim())
          .map((a) => ({ action_text: a.action_text, owner: a.owner, due_by: a.due_by })),
        fcapItems
      );
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Failed to export PDF.');
    } finally {
      setExportingPdf(false);
    }
  };
  const recapSections: { label: string; value: string }[] = [
    { label: 'Sales Action Plan', value: salesActionPlan },
    { label: 'Food Cost Action Plan', value: foodCostComments },
    { label: 'Labour Action Plan', value: labourReviewActionPlan },
    { label: 'Hiring Notes', value: hiringNotes },
    { label: 'TM MOTs of Note', value: tmMotsOfNote },
    { label: 'Development Path Updates', value: developmentPathUpdates },
    { label: 'R&M Issues', value: rmIssues },
    { label: 'Cleaning Focus', value: cleaningFocus },
    { label: 'Features', value: [featureItems.map((f) => f.name).filter(Boolean).join(', '), featuresNotes].filter(Boolean).join(' — ') },
    { label: 'Audit Score', value: [auditScore && `${auditScore}%`, auditScoreComment].filter(Boolean).join(' — ') },
  ].filter((s) => s.value);

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <StepProgressHeader meta={STEP_META.recap} />

      <div className="mt-6 space-y-3">
        <h3 className="text-base font-semibold text-slate-800">Weekly Recap</h3>
        {recapSections.length === 0 && (
          <p className="text-sm text-slate-500">No notes recorded yet.</p>
        )}
        {recapSections.map((s) => (
          <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase">{s.label}</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-slate-800">Actions for the Week Ahead</h3>
          <button
            onClick={handleDraftActions}
            disabled={draftingActions}
            className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {draftingActions ? 'Drafting...' : 'Draft from this week’s notes'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          The concrete actions you’re committing to next week. Draft a starting list from
          this week’s notes, then edit, add an owner and a target, and save. These carry
          forward — you’ll review them at the start of next week’s package.
        </p>
        {actionsError && <p className="text-sm text-red-600 mb-2">{actionsError}</p>}
        {actionsLoading && <p className="text-sm text-slate-500 mb-2">Loading saved actions…</p>}

        <div className="space-y-2">
          {weekAheadActions.length === 0 && !actionsLoading && (
            <p className="text-sm text-slate-500">
              No actions yet. Draft from your notes above, or add one manually.
            </p>
          )}
          {weekAheadActions.map((action, index) => (
            <div key={action.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-sm font-semibold text-slate-400 pt-2">{index + 1}.</span>
                <div className="flex-1 space-y-2">
                  <textarea
                    value={action.action_text}
                    onChange={(e) => handleActionFieldChange(action.id, 'action_text', e.target.value)}
                    rows={2}
                    placeholder="What will you do next week? (e.g. Retrain line on portioning for high-variance items)"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  />
                  <div className="flex gap-2">
                    <input
                      value={action.owner}
                      onChange={(e) => handleActionFieldChange(action.id, 'owner', e.target.value)}
                      placeholder="Owner (e.g. Sous, Chef)"
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                    <input
                      value={action.due_by}
                      onChange={(e) => handleActionFieldChange(action.id, 'due_by', e.target.value)}
                      placeholder="By when (e.g. Fri)"
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveAction(action.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                  title="Remove action"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-3">
          <button
            onClick={handleAddAction}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-700 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add action
          </button>
          <div className="flex items-center gap-3">
            {actionsSavedAt && (
              <span className="text-xs text-slate-400">
                Saved {new Date(actionsSavedAt).toLocaleString()}
              </span>
            )}
            <button
              onClick={handleSaveActions}
              disabled={savingActions}
              className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {savingActions ? 'Saving...' : 'Save Actions'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">AI Summary</label>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Summary'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <textarea
          value={aiSummary}
          onChange={(e) => onAiSummaryChange(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
        />
      </div>

      <div className="mt-6">
        {pdfError && <p className="text-sm text-red-600 mb-2">{pdfError}</p>}
        <button
          onClick={handleExportFullSummaryPdf}
          disabled={exportingPdf}
          className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {exportingPdf ? 'Preparing PDF...' : 'Export Full Chef Summary (PDF)'}
        </button>
      </div>

      <div className="mt-8 flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleFinish}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
        >
          Finish
        </button>
      </div>
    </div>
  );
}
