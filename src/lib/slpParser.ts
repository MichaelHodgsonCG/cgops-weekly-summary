export interface SLPSalesData {
  locationName: string;
  totalDailySales: number | null;
  totalWtdSales: number | null;
  dailySalesVsProjections: number | null;
  wtdSalesVsProjections: number | null;
  dailySalesVsLastYear: number | null;
  wtdSalesVsLastYear: number | null;
  wtdSalesVsLastYearPct: number | null;
}

export interface SLPLabourData {
  locationName: string;
  department: string;
  labourBudgetPct: number | null;
  dailyLabourActualPct: number | null;
  wtdLabourActualPct: number | null;
  dailyLabourProjectionPct: number | null;
  fullWeekLabourProjectionPct: number | null;
  dailyLabourDollarsVsProjections: number | null;
  wtdLabourDollarsVsProjections: number | null;
  wtdLabourPctVsBudgetPct: number | null;
  wtdLabourDollarsVsSales: number | null;
  wtdLabourDollars: number | null;
}

export interface SLPPromoData {
  locationName: string;
  relationshipDollars: number | null;
  substandardDollars: number | null;
  totalPromoPct: number | null;
}

export interface ParsedSLPData {
  sales: SLPSalesData[];
  labour: SLPLabourData[];
  promos: SLPPromoData[];
}

function parseNumericValue(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const cleaned = value.replace(/,/g, '').replace(/\s+/g, '').trim();
  if (cleaned === '') return null;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

export function parseSLPCSV(csvContent: string): ParsedSLPData {
  const lines = csvContent.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error('Invalid CSV format: File is empty or missing header');
  }

  const headerLine = parseCSVLine(lines[1]);
  const TOTAL_KEY = '__TOTAL__';
  const locations = headerLine.slice(2)
    .filter(loc => loc && loc.trim() !== '')
    .map(loc => loc.trim().toLowerCase() === 'total' ? TOTAL_KEY : loc);

  if (locations.length === 0) {
    throw new Error('Invalid CSV format: No locations found in header');
  }

  const salesMap = new Map<string, SLPSalesData>();
  const labourMap = new Map<string, SLPLabourData[]>();
  const promosMap = new Map<string, SLPPromoData>();

  locations.forEach(locationName => {
    salesMap.set(locationName, {
      locationName,
      totalDailySales: null,
      totalWtdSales: null,
      dailySalesVsProjections: null,
      wtdSalesVsProjections: null,
      dailySalesVsLastYear: null,
      wtdSalesVsLastYear: null,
      wtdSalesVsLastYearPct: null,
    });

    promosMap.set(locationName, {
      locationName,
      relationshipDollars: null,
      substandardDollars: null,
      totalPromoPct: null,
    });

    labourMap.set(locationName, []);
  });

  let currentDepartment = '';
  let currentDepartmentLabour = new Map<string, SLPLabourData>();

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    const columns = parseCSVLine(line);
    const kpiName = columns[0]?.trim() || '';

    if (!kpiName) continue;

    if (kpiName === 'BOH' || kpiName === 'FOH' || kpiName === 'Manager') {
      if (currentDepartment && currentDepartmentLabour.size > 0) {
        currentDepartmentLabour.forEach((labour, locName) => {
          const labourList = labourMap.get(locName);
          if (labourList) {
            labourList.push(labour);
          }
        });
      }

      currentDepartment = kpiName;
      currentDepartmentLabour = new Map();

      locations.forEach(locationName => {
        currentDepartmentLabour.set(locationName, {
          locationName,
          department: currentDepartment,
          labourBudgetPct: null,
          dailyLabourActualPct: null,
          wtdLabourActualPct: null,
          dailyLabourProjectionPct: null,
          fullWeekLabourProjectionPct: null,
          dailyLabourDollarsVsProjections: null,
          wtdLabourDollarsVsProjections: null,
          wtdLabourPctVsBudgetPct: null,
          wtdLabourDollarsVsSales: null,
          wtdLabourDollars: null,
        });
      });
      continue;
    }

    if (kpiName === 'Maintenance' || kpiName === 'PUSH TEST' || kpiName === 'TEST' || kpiName === 'Promos') {
      if (currentDepartment && currentDepartmentLabour.size > 0) {
        currentDepartmentLabour.forEach((labour, locName) => {
          const labourList = labourMap.get(locName);
          if (labourList) {
            labourList.push(labour);
          }
        });
        currentDepartment = '';
        currentDepartmentLabour = new Map();
      }
      continue;
    }

    if (kpiName.startsWith('1. Total Daily Sales')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const sales = salesMap.get(locationName);
        if (sales) sales.totalDailySales = value;
      });
    } else if (kpiName.startsWith('2. Total WTD Sales')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const sales = salesMap.get(locationName);
        if (sales) sales.totalWtdSales = value;
      });
    } else if (kpiName.startsWith('3. Daily Sales +/- Projections')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const sales = salesMap.get(locationName);
        if (sales) sales.dailySalesVsProjections = value;
      });
    } else if (kpiName.startsWith('4. WTD Sales +/- Projections')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const sales = salesMap.get(locationName);
        if (sales) sales.wtdSalesVsProjections = value;
      });
    } else if (kpiName.startsWith('5. Daily Sales +/- Last Year')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const sales = salesMap.get(locationName);
        if (sales) sales.dailySalesVsLastYear = value;
      });
    } else if (kpiName.startsWith('6. WTD Sales +/- Last Year')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const sales = salesMap.get(locationName);
        if (sales) sales.wtdSalesVsLastYear = value;
      });
    } else if (kpiName.startsWith('7. WTD Sales +/- Last Year %')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const sales = salesMap.get(locationName);
        if (sales) sales.wtdSalesVsLastYearPct = value;
      });
    }

    if (currentDepartment && kpiName.includes(': 0. Total Labour $')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const labour = currentDepartmentLabour.get(locationName);
        if (labour) labour.wtdLabourDollars = value;
      });
    } else if (currentDepartment && kpiName.includes(': 1. Labour Budget %')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const labour = currentDepartmentLabour.get(locationName);
        if (labour) labour.labourBudgetPct = value;
      });
    } else if (currentDepartment && kpiName.includes(': 2. Daily Labour Actual % of Sales')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const labour = currentDepartmentLabour.get(locationName);
        if (labour) labour.dailyLabourActualPct = value;
      });
    } else if (currentDepartment && kpiName.includes(': 3. WTD Labour Actual % of Sales')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const labour = currentDepartmentLabour.get(locationName);
        if (labour) labour.wtdLabourActualPct = value;
      });
    } else if (currentDepartment && kpiName.includes(': 4. Daily Labour Projection % of Sales')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const labour = currentDepartmentLabour.get(locationName);
        if (labour) labour.dailyLabourProjectionPct = value;
      });
    } else if (currentDepartment && kpiName.includes(': 5. Full Week Labour Projection % of Sales')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const labour = currentDepartmentLabour.get(locationName);
        if (labour) labour.fullWeekLabourProjectionPct = value;
      });
    } else if (currentDepartment && kpiName.includes(': 6. Daily Labour $ +/- Labour Projections')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const labour = currentDepartmentLabour.get(locationName);
        if (labour) labour.dailyLabourDollarsVsProjections = value;
      });
    } else if (currentDepartment && kpiName.includes(': 7. WTD Labour $ +/- Labour Projections')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const labour = currentDepartmentLabour.get(locationName);
        if (labour) labour.wtdLabourDollarsVsProjections = value;
      });
    } else if (currentDepartment && kpiName.includes(': 8. WTD Labour % +/- Labour Budget %')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const labour = currentDepartmentLabour.get(locationName);
        if (labour) labour.wtdLabourPctVsBudgetPct = value;
      });
    } else if (currentDepartment && kpiName.includes(': 9 WTD Labour $ +/- Relative to Sales')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const labour = currentDepartmentLabour.get(locationName);
        if (labour) labour.wtdLabourDollarsVsSales = value;
      });
    }

    if (kpiName.startsWith('Relationship $')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const promo = promosMap.get(locationName);
        if (promo) promo.relationshipDollars = value;
      });
    } else if (kpiName.startsWith('Substandard $')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const promo = promosMap.get(locationName);
        if (promo) promo.substandardDollars = value;
      });
    } else if (kpiName.startsWith('Total Promo %')) {
      locations.forEach((locationName, idx) => {
        const value = parseNumericValue(columns[idx + 2]);
        const promo = promosMap.get(locationName);
        if (promo) promo.totalPromoPct = value;
      });
    }
  }

  if (currentDepartment && currentDepartmentLabour.size > 0) {
    currentDepartmentLabour.forEach((labour, locName) => {
      const labourList = labourMap.get(locName);
      if (labourList) {
        labourList.push(labour);
      }
    });
  }

  const sales = Array.from(salesMap.values());
  const labour = Array.from(labourMap.values()).flat();
  const promos = Array.from(promosMap.values());

  return { sales, labour, promos };
}
