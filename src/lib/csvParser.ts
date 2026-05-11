export type ParsedLineItem = {
  line_item_name: string;
  current_actual: number | null;
  current_actual_pct: number | null;
  current_budget: number | null;
  current_budget_pct: number | null;
  prior_year: number | null;
  prior_year_pct: number | null;
  ytd_actual: number | null;
  ytd_actual_pct: number | null;
  ytd_budget: number | null;
  ytd_budget_pct: number | null;
  prior_ytd: number | null;
  prior_ytd_pct: number | null;
  qtd_actual: number | null;
  qtd_actual_pct: number | null;
  qtd_budget: number | null;
  qtd_budget_pct: number | null;
};

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

const LINE_ITEM_PATTERNS = [
  { name: 'Food Sales', pattern: /^\s*Food - Apps/ },
  { name: 'Total Sales', pattern: /^\s*Total Sales,/ },
  { name: 'Cost of Sales (Food)', pattern: /^\s*Food,.*Cost Of Product/i },
  { name: 'Kitchen Labour', pattern: /^\s*Kitchen,.*Cost Of Labour/i },
  { name: 'Kitchen Supplies', pattern: /^\s*Kitchen Supplies,/ },
  { name: 'Table and Dishware', pattern: /^\s*Table and Dishware,/ },
  { name: 'IHP Substandard Product', pattern: /^\s*IHP Substandard Product,/ },
  { name: 'R&M Equipment', pattern: /^\s*Equipment,.*Repairs & Maintenance/i },
  { name: 'EBITDA', pattern: /^\s*EBITDA,/ }
];

function parseNumber(value: string): number | null {
  if (!value || value.trim() === '') return null;

  let cleaned = value.replace(/,/g, '');

  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function parsePercentage(value: string): number | null {
  if (!value || value.trim() === '') return null;

  let cleaned = value.replace(/%/g, '').replace(/,/g, '');

  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function parseWeeklyFormat(
  lines: string[],
  locationName: string | undefined,
  weekEndingDate: string | undefined
): {
  lineItems: ParsedLineItem[];
  errors: string[];
  locationName?: string;
  weekEndingDate?: string;
} {
  const lineItems: ParsedLineItem[] = [];
  const errors: string[] = [];
  const foundItems = new Set<string>();

  let inCostOfProduct = false;
  let inCostOfLabour = false;
  let inRepairsMaintenance = false;

  for (let i = 10; i < lines.length; i++) {
    const line = lines[i];
    const parts = parseCSVLine(line);

    if (line.includes('Cost Of Product')) {
      inCostOfProduct = true;
      inCostOfLabour = false;
      inRepairsMaintenance = false;
      continue;
    }
    if (line.includes('Cost Of Labour')) {
      inCostOfLabour = true;
      inCostOfProduct = false;
      inRepairsMaintenance = false;
      continue;
    }
    if (line.includes('Repairs & Maintenance')) {
      inRepairsMaintenance = true;
      inCostOfProduct = false;
      inCostOfLabour = false;
      continue;
    }
    if (line.includes('Total ') || line.includes('Expenses') || line.includes('Fixed Charges')) {
      inCostOfProduct = false;
      inCostOfLabour = false;
      inRepairsMaintenance = false;
    }

    if (line.includes('Total Sales - Food') && !foundItems.has('Food Sales')) {
      if (parts.length >= 12) {
        const item: ParsedLineItem = {
          line_item_name: 'Food Sales',
          current_actual: parseNumber(parts[3]),
          current_actual_pct: parsePercentage(parts[4]),
          current_budget: parseNumber(parts[5]),
          current_budget_pct: parsePercentage(parts[6]),
          prior_year: parseNumber(parts[1]),
          prior_year_pct: parsePercentage(parts[2]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: null,
          prior_ytd_pct: null,
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('Food Sales');
      }
    }

    else if (line.trim().startsWith('Total Sales,')) {
      if (parts.length >= 12) {
        const item: ParsedLineItem = {
          line_item_name: 'Total Sales',
          current_actual: parseNumber(parts[3]),
          current_actual_pct: parsePercentage(parts[4]),
          current_budget: parseNumber(parts[5]),
          current_budget_pct: parsePercentage(parts[6]),
          prior_year: parseNumber(parts[1]),
          prior_year_pct: parsePercentage(parts[2]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: null,
          prior_ytd_pct: null,
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('Total Sales');
      }
    }

    else if (inCostOfProduct && line.trim().startsWith('Food,')) {
      if (parts.length >= 12) {
        const item: ParsedLineItem = {
          line_item_name: 'Cost of Sales (Food)',
          current_actual: parseNumber(parts[3]),
          current_actual_pct: parsePercentage(parts[4]),
          current_budget: parseNumber(parts[5]),
          current_budget_pct: parsePercentage(parts[6]),
          prior_year: parseNumber(parts[1]),
          prior_year_pct: parsePercentage(parts[2]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: null,
          prior_ytd_pct: null,
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('Cost of Sales (Food)');
      }
    }

    else if (inCostOfLabour && line.trim().startsWith('Kitchen,')) {
      if (parts.length >= 12) {
        const item: ParsedLineItem = {
          line_item_name: 'Kitchen Labour',
          current_actual: parseNumber(parts[3]),
          current_actual_pct: parsePercentage(parts[4]),
          current_budget: parseNumber(parts[5]),
          current_budget_pct: parsePercentage(parts[6]),
          prior_year: parseNumber(parts[1]),
          prior_year_pct: parsePercentage(parts[2]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: null,
          prior_ytd_pct: null,
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('Kitchen Labour');
      }
    }

    else if (line.includes('Kitchen Supplies,')) {
      if (parts.length >= 12) {
        const item: ParsedLineItem = {
          line_item_name: 'Kitchen Supplies',
          current_actual: parseNumber(parts[3]),
          current_actual_pct: parsePercentage(parts[4]),
          current_budget: parseNumber(parts[5]),
          current_budget_pct: parsePercentage(parts[6]),
          prior_year: parseNumber(parts[1]),
          prior_year_pct: parsePercentage(parts[2]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: null,
          prior_ytd_pct: null,
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('Kitchen Supplies');
      }
    }

    else if (line.includes('Table and Dishware,')) {
      if (parts.length >= 12) {
        const item: ParsedLineItem = {
          line_item_name: 'Table and Dishware',
          current_actual: parseNumber(parts[3]),
          current_actual_pct: parsePercentage(parts[4]),
          current_budget: parseNumber(parts[5]),
          current_budget_pct: parsePercentage(parts[6]),
          prior_year: parseNumber(parts[1]),
          prior_year_pct: parsePercentage(parts[2]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: null,
          prior_ytd_pct: null,
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('Table and Dishware');
      }
    }

    else if (line.includes('IHP Substandard Product,')) {
      if (parts.length >= 12) {
        const item: ParsedLineItem = {
          line_item_name: 'IHP Substandard Product',
          current_actual: parseNumber(parts[3]),
          current_actual_pct: parsePercentage(parts[4]),
          current_budget: parseNumber(parts[5]),
          current_budget_pct: parsePercentage(parts[6]),
          prior_year: parseNumber(parts[1]),
          prior_year_pct: parsePercentage(parts[2]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: null,
          prior_ytd_pct: null,
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('IHP Substandard Product');
      }
    }

    else if (inRepairsMaintenance && line.trim().startsWith('Equipment,')) {
      if (parts.length >= 12) {
        const item: ParsedLineItem = {
          line_item_name: 'R&M Equipment',
          current_actual: parseNumber(parts[3]),
          current_actual_pct: parsePercentage(parts[4]),
          current_budget: parseNumber(parts[5]),
          current_budget_pct: parsePercentage(parts[6]),
          prior_year: parseNumber(parts[1]),
          prior_year_pct: parsePercentage(parts[2]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: null,
          prior_ytd_pct: null,
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('R&M Equipment');
      }
    }

    else if (line.trim().startsWith('EBITDA,')) {
      if (parts.length >= 12) {
        const item: ParsedLineItem = {
          line_item_name: 'EBITDA',
          current_actual: parseNumber(parts[3]),
          current_actual_pct: parsePercentage(parts[4]),
          current_budget: parseNumber(parts[5]),
          current_budget_pct: parsePercentage(parts[6]),
          prior_year: parseNumber(parts[1]),
          prior_year_pct: parsePercentage(parts[2]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: null,
          prior_ytd_pct: null,
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('EBITDA');
      }
    }
  }

  const requiredItems = [
    'Food Sales',
    'Total Sales',
    'Cost of Sales (Food)',
    'Kitchen Labour',
    'Kitchen Supplies',
    'Table and Dishware',
    'IHP Substandard Product',
    'R&M Equipment',
    'EBITDA'
  ];

  for (const required of requiredItems) {
    if (!foundItems.has(required)) {
      errors.push(`Missing required line item: ${required}`);
    }
  }

  return { lineItems, errors, locationName, weekEndingDate };
}

export function parseCSV(csvContent: string): {
  lineItems: ParsedLineItem[];
  errors: string[];
  locationName?: string;
  weekEndingDate?: string;
} {
  const lines = csvContent.split('\n');
  const lineItems: ParsedLineItem[] = [];
  const errors: string[] = [];
  const foundItems = new Set<string>();

  let locationName: string | undefined;
  let weekEndingDate: string | undefined;

  let isWeeklyFormat = false;

  if (lines.length >= 9) {
    const headerLine = parseCSVLine(lines[7]);
    if (headerLine[0]?.includes('Week Ending')) {
      isWeeklyFormat = true;
    }
  }

  if (lines.length >= 3) {
    const firstLine = parseCSVLine(lines[0]);
    if (firstLine[0]) {
      locationName = firstLine[0]
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    }

    if (isWeeklyFormat && lines.length >= 9) {
      const dateLine = parseCSVLine(lines[8]);
      if (dateLine[3]) {
        const dateStr = dateLine[3].replace(/"/g, '').trim();
        try {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            const dayOfWeek = date.getDay();
            const diff = dayOfWeek === 0 ? 0 : dayOfWeek;
            const sunday = new Date(date);
            sunday.setDate(date.getDate() - diff);
            weekEndingDate = sunday.toISOString().split('T')[0];
          }
        } catch (e) {
          console.error('Date parsing error:', e);
        }
      }
    } else {
      const thirdLine = parseCSVLine(lines[2]);
      if (thirdLine[0]) {
        const dateMatch = thirdLine[0].match(/As of\s+(.+?)(?:,\s*(\d{4}))?$/i);
        if (dateMatch) {
          const dateStr = dateMatch[1].trim();
          const year = dateMatch[2];
          try {
            const date = new Date(dateStr + (year ? `, ${year}` : ''));
            if (!isNaN(date.getTime())) {
              const dayOfWeek = date.getDay();
              const diff = dayOfWeek === 0 ? 0 : dayOfWeek;
              const sunday = new Date(date);
              sunday.setDate(date.getDate() - diff);
              weekEndingDate = sunday.toISOString().split('T')[0];
            }
          } catch (e) {
            console.error('Date parsing error:', e);
          }
        }
      }
    }
  }

  if (isWeeklyFormat) {
    return parseWeeklyFormat(lines, locationName, weekEndingDate);
  }

  let inCostOfProduct = false;
  let inCostOfLabour = false;
  let inRepairsMaintenance = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('Cost Of Product')) {
      inCostOfProduct = true;
      inCostOfLabour = false;
      inRepairsMaintenance = false;
      continue;
    }
    if (line.includes('Cost Of Labour')) {
      inCostOfLabour = true;
      inCostOfProduct = false;
      inRepairsMaintenance = false;
      continue;
    }
    if (line.includes('Repairs & Maintenance')) {
      inRepairsMaintenance = true;
      inCostOfProduct = false;
      inCostOfLabour = false;
      continue;
    }
    if (line.includes('Total ') || line.includes('Expenses') || line.includes('Fixed Charges')) {
      inCostOfProduct = false;
      inCostOfLabour = false;
      inRepairsMaintenance = false;
    }

    if (line.includes('Total Sales - Food') && !foundItems.has('Food Sales')) {
      const parts = parseCSVLine(line);
      if (parts.length >= 13) {
        const item: ParsedLineItem = {
          line_item_name: 'Food Sales',
          current_actual: parseNumber(parts[1]),
          current_actual_pct: parsePercentage(parts[2]),
          current_budget: parseNumber(parts[3]),
          current_budget_pct: parsePercentage(parts[4]),
          prior_year: parseNumber(parts[5]),
          prior_year_pct: parsePercentage(parts[6]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: parseNumber(parts[11]),
          prior_ytd_pct: parsePercentage(parts[12]),
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('Food Sales');
      }
    }

    else if (line.trim().startsWith('Total Sales,')) {
      const parts = parseCSVLine(line);
      if (parts.length >= 13) {
        const item: ParsedLineItem = {
          line_item_name: 'Total Sales',
          current_actual: parseNumber(parts[1]),
          current_actual_pct: parsePercentage(parts[2]),
          current_budget: parseNumber(parts[3]),
          current_budget_pct: parsePercentage(parts[4]),
          prior_year: parseNumber(parts[5]),
          prior_year_pct: parsePercentage(parts[6]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: parseNumber(parts[11]),
          prior_ytd_pct: parsePercentage(parts[12]),
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('Total Sales');
      }
    }

    else if (inCostOfProduct && line.trim().startsWith('Food,')) {
      const parts = parseCSVLine(line);
      if (parts.length >= 13) {
        const item: ParsedLineItem = {
          line_item_name: 'Cost of Sales (Food)',
          current_actual: parseNumber(parts[1]),
          current_actual_pct: parsePercentage(parts[2]),
          current_budget: parseNumber(parts[3]),
          current_budget_pct: parsePercentage(parts[4]),
          prior_year: parseNumber(parts[5]),
          prior_year_pct: parsePercentage(parts[6]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: parseNumber(parts[11]),
          prior_ytd_pct: parsePercentage(parts[12]),
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('Cost of Sales (Food)');
      }
    }

    else if (inCostOfLabour && line.trim().startsWith('Kitchen,')) {
      const parts = parseCSVLine(line);
      if (parts.length >= 13) {
        const item: ParsedLineItem = {
          line_item_name: 'Kitchen Labour',
          current_actual: parseNumber(parts[1]),
          current_actual_pct: parsePercentage(parts[2]),
          current_budget: parseNumber(parts[3]),
          current_budget_pct: parsePercentage(parts[4]),
          prior_year: parseNumber(parts[5]),
          prior_year_pct: parsePercentage(parts[6]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: parseNumber(parts[11]),
          prior_ytd_pct: parsePercentage(parts[12]),
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('Kitchen Labour');
      }
    }

    else if (line.includes('Kitchen Supplies,')) {
      const parts = parseCSVLine(line);
      if (parts.length >= 13) {
        const item: ParsedLineItem = {
          line_item_name: 'Kitchen Supplies',
          current_actual: parseNumber(parts[1]),
          current_actual_pct: parsePercentage(parts[2]),
          current_budget: parseNumber(parts[3]),
          current_budget_pct: parsePercentage(parts[4]),
          prior_year: parseNumber(parts[5]),
          prior_year_pct: parsePercentage(parts[6]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: parseNumber(parts[11]),
          prior_ytd_pct: parsePercentage(parts[12]),
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('Kitchen Supplies');
      }
    }

    else if (line.includes('Table and Dishware,')) {
      const parts = parseCSVLine(line);
      if (parts.length >= 13) {
        const item: ParsedLineItem = {
          line_item_name: 'Table and Dishware',
          current_actual: parseNumber(parts[1]),
          current_actual_pct: parsePercentage(parts[2]),
          current_budget: parseNumber(parts[3]),
          current_budget_pct: parsePercentage(parts[4]),
          prior_year: parseNumber(parts[5]),
          prior_year_pct: parsePercentage(parts[6]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: parseNumber(parts[11]),
          prior_ytd_pct: parsePercentage(parts[12]),
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('Table and Dishware');
      }
    }

    else if (line.includes('IHP Substandard Product,')) {
      const parts = parseCSVLine(line);
      if (parts.length >= 13) {
        const item: ParsedLineItem = {
          line_item_name: 'IHP Substandard Product',
          current_actual: parseNumber(parts[1]),
          current_actual_pct: parsePercentage(parts[2]),
          current_budget: parseNumber(parts[3]),
          current_budget_pct: parsePercentage(parts[4]),
          prior_year: parseNumber(parts[5]),
          prior_year_pct: parsePercentage(parts[6]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: parseNumber(parts[11]),
          prior_ytd_pct: parsePercentage(parts[12]),
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('IHP Substandard Product');
      }
    }

    else if (inRepairsMaintenance && line.trim().startsWith('Equipment,')) {
      const parts = parseCSVLine(line);
      if (parts.length >= 13) {
        const item: ParsedLineItem = {
          line_item_name: 'R&M Equipment',
          current_actual: parseNumber(parts[1]),
          current_actual_pct: parsePercentage(parts[2]),
          current_budget: parseNumber(parts[3]),
          current_budget_pct: parsePercentage(parts[4]),
          prior_year: parseNumber(parts[5]),
          prior_year_pct: parsePercentage(parts[6]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: parseNumber(parts[11]),
          prior_ytd_pct: parsePercentage(parts[12]),
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('R&M Equipment');
      }
    }

    else if (line.trim().startsWith('EBITDA,')) {
      const parts = parseCSVLine(line);
      if (parts.length >= 13) {
        const item: ParsedLineItem = {
          line_item_name: 'EBITDA',
          current_actual: parseNumber(parts[1]),
          current_actual_pct: parsePercentage(parts[2]),
          current_budget: parseNumber(parts[3]),
          current_budget_pct: parsePercentage(parts[4]),
          prior_year: parseNumber(parts[5]),
          prior_year_pct: parsePercentage(parts[6]),
          ytd_actual: parseNumber(parts[7]),
          ytd_actual_pct: parsePercentage(parts[8]),
          ytd_budget: parseNumber(parts[9]),
          ytd_budget_pct: parsePercentage(parts[10]),
          prior_ytd: parseNumber(parts[11]),
          prior_ytd_pct: parsePercentage(parts[12]),
          qtd_actual: null,
          qtd_actual_pct: null,
          qtd_budget: null,
          qtd_budget_pct: null
        };
        lineItems.push(item);
        foundItems.add('EBITDA');
      }
    }
  }

  const requiredItems = [
    'Food Sales',
    'Total Sales',
    'Cost of Sales (Food)',
    'Kitchen Labour',
    'Kitchen Supplies',
    'Table and Dishware',
    'IHP Substandard Product',
    'R&M Equipment',
    'EBITDA'
  ];

  for (const required of requiredItems) {
    if (!foundItems.has(required)) {
      errors.push(`Missing required line item: ${required}`);
    }
  }

  return { lineItems, errors, locationName, weekEndingDate };
}
