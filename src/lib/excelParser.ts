import * as XLSX from 'xlsx';
import { ParsedLineItem } from './csvParser';

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    let cleaned = value.replace(/,/g, '');

    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      cleaned = '-' + cleaned.slice(1, -1);
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

function parsePercentage(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') return value * 100;

  if (typeof value === 'string') {
    let cleaned = value.replace(/%/g, '').replace(/,/g, '');

    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      cleaned = '-' + cleaned.slice(1, -1);
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

export interface WeekData {
  weekEndingDate: string;
  lineItems: ParsedLineItem[];
}

function parseWeeklyExcelFormat(
  rows: any[][],
  locationName: string | undefined
): {
  weeks: WeekData[];
  errors: string[];
  locationName?: string;
} {
  const errors: string[] = [];
  const weeks: WeekData[] = [];

  const headerRow = rows[7];
  const dateRow = rows[8];

  const weekColumns: { startCol: number; endCol: number; date: string }[] = [];

  for (let col = 1; col < headerRow.length; col++) {
    const headerText = String(headerRow[col] || '').trim();
    if (headerText.includes('Week Ending')) {
      const dateVal = dateRow[col];
      let weekEndingDate: string | null = null;

      try {
        let date: Date;
        if (typeof dateVal === 'number') {
          date = XLSX.SSF.parse_date_code(dateVal);
        } else {
          date = new Date(String(dateVal));
        }
        if (!isNaN(date.getTime())) {
          const dayOfWeek = date.getDay();
          const diff = dayOfWeek === 0 ? 0 : dayOfWeek;
          const sunday = new Date(date);
          sunday.setDate(date.getDate() - diff);
          weekEndingDate = sunday.toISOString().split('T')[0];
        }
      } catch (err) {
        console.error('Date parsing error:', err);
      }

      if (weekEndingDate) {
        weekColumns.push({
          startCol: col,
          endCol: col + 1,
          date: weekEndingDate
        });
      }
    }
  }

  for (const weekCol of weekColumns) {
    const lineItems: ParsedLineItem[] = [];
    const foundItems = new Set<string>();

    let inCostOfProduct = false;
    let inCostOfLabour = false;
    let inRepairsMaintenance = false;

    for (let i = 9; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const firstCell = String(row[0] || '').trim();

      if (firstCell.includes('Cost Of Product')) {
        inCostOfProduct = true;
        inCostOfLabour = false;
        inRepairsMaintenance = false;
        continue;
      }
      if (firstCell.includes('Cost Of Labour')) {
        inCostOfLabour = true;
        inCostOfProduct = false;
        inRepairsMaintenance = false;
        continue;
      }
      if (firstCell.includes('Repairs & Maintenance')) {
        inRepairsMaintenance = true;
        inCostOfProduct = false;
        inCostOfLabour = false;
        continue;
      }
      if (firstCell.includes('Total ') || firstCell.includes('Expenses') || firstCell.includes('Fixed Charges')) {
        inCostOfProduct = false;
        inCostOfLabour = false;
        inRepairsMaintenance = false;
      }

      if (firstCell.includes('Total Sales - Food') && !foundItems.has('Food Sales')) {
        const item: ParsedLineItem = {
          line_item_name: 'Food Sales',
          current_actual: parseNumber(row[weekCol.startCol]),
          current_actual_pct: parsePercentage(row[weekCol.endCol]),
          current_budget: null,
          current_budget_pct: null,
          prior_year: null,
          prior_year_pct: null,
          ytd_actual: null,
          ytd_actual_pct: null,
          ytd_budget: null,
          ytd_budget_pct: null,
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

      else if (firstCell === 'Total Sales') {
        const item: ParsedLineItem = {
          line_item_name: 'Total Sales',
          current_actual: parseNumber(row[weekCol.startCol]),
          current_actual_pct: parsePercentage(row[weekCol.endCol]),
          current_budget: null,
          current_budget_pct: null,
          prior_year: null,
          prior_year_pct: null,
          ytd_actual: null,
          ytd_actual_pct: null,
          ytd_budget: null,
          ytd_budget_pct: null,
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

      else if (inCostOfProduct && firstCell === 'Food') {
        const item: ParsedLineItem = {
          line_item_name: 'Cost of Sales (Food)',
          current_actual: parseNumber(row[weekCol.startCol]),
          current_actual_pct: parsePercentage(row[weekCol.endCol]),
          current_budget: null,
          current_budget_pct: null,
          prior_year: null,
          prior_year_pct: null,
          ytd_actual: null,
          ytd_actual_pct: null,
          ytd_budget: null,
          ytd_budget_pct: null,
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

      else if (inCostOfLabour && firstCell === 'Kitchen') {
        const item: ParsedLineItem = {
          line_item_name: 'Kitchen Labour',
          current_actual: parseNumber(row[weekCol.startCol]),
          current_actual_pct: parsePercentage(row[weekCol.endCol]),
          current_budget: null,
          current_budget_pct: null,
          prior_year: null,
          prior_year_pct: null,
          ytd_actual: null,
          ytd_actual_pct: null,
          ytd_budget: null,
          ytd_budget_pct: null,
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

      else if (firstCell === 'Kitchen Supplies') {
        const item: ParsedLineItem = {
          line_item_name: 'Kitchen Supplies',
          current_actual: parseNumber(row[weekCol.startCol]),
          current_actual_pct: parsePercentage(row[weekCol.endCol]),
          current_budget: null,
          current_budget_pct: null,
          prior_year: null,
          prior_year_pct: null,
          ytd_actual: null,
          ytd_actual_pct: null,
          ytd_budget: null,
          ytd_budget_pct: null,
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

      else if (firstCell === 'Table and Dishware') {
        const item: ParsedLineItem = {
          line_item_name: 'Table and Dishware',
          current_actual: parseNumber(row[weekCol.startCol]),
          current_actual_pct: parsePercentage(row[weekCol.endCol]),
          current_budget: null,
          current_budget_pct: null,
          prior_year: null,
          prior_year_pct: null,
          ytd_actual: null,
          ytd_actual_pct: null,
          ytd_budget: null,
          ytd_budget_pct: null,
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

      else if (firstCell === 'IHP Substandard Product') {
        const item: ParsedLineItem = {
          line_item_name: 'IHP Substandard Product',
          current_actual: parseNumber(row[weekCol.startCol]),
          current_actual_pct: parsePercentage(row[weekCol.endCol]),
          current_budget: null,
          current_budget_pct: null,
          prior_year: null,
          prior_year_pct: null,
          ytd_actual: null,
          ytd_actual_pct: null,
          ytd_budget: null,
          ytd_budget_pct: null,
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

      else if (inRepairsMaintenance && firstCell === 'Equipment') {
        const item: ParsedLineItem = {
          line_item_name: 'R&M Equipment',
          current_actual: parseNumber(row[weekCol.startCol]),
          current_actual_pct: parsePercentage(row[weekCol.endCol]),
          current_budget: null,
          current_budget_pct: null,
          prior_year: null,
          prior_year_pct: null,
          ytd_actual: null,
          ytd_actual_pct: null,
          ytd_budget: null,
          ytd_budget_pct: null,
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

      else if (firstCell === 'EBITDA') {
        const item: ParsedLineItem = {
          line_item_name: 'EBITDA',
          current_actual: parseNumber(row[weekCol.startCol]),
          current_actual_pct: parsePercentage(row[weekCol.endCol]),
          current_budget: null,
          current_budget_pct: null,
          prior_year: null,
          prior_year_pct: null,
          ytd_actual: null,
          ytd_actual_pct: null,
          ytd_budget: null,
          ytd_budget_pct: null,
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
        errors.push(`Week ${weekCol.date}: Missing required line item: ${required}`);
      }
    }

    weeks.push({
      weekEndingDate: weekCol.date,
      lineItems
    });
  }

  return { weeks, errors, locationName };
}

export function parseExcel(file: File): Promise<{
  lineItems: ParsedLineItem[];
  errors: string[];
  locationName?: string;
  weekEndingDate?: string;
  weeks?: WeekData[];
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        const lineItems: ParsedLineItem[] = [];
        const errors: string[] = [];
        const foundItems = new Set<string>();

        let locationName: string | undefined;
        let weekEndingDate: string | undefined;

        let isWeeklyFormat = false;

        if (rows.length >= 8) {
          const headerRow = rows[7];
          if (headerRow && String(headerRow[0] || '').includes('Week Ending')) {
            isWeeklyFormat = true;
          }
        }

        if (rows.length >= 3) {
          if (rows[0] && rows[0][0]) {
            locationName = String(rows[0][0])
              .trim()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');
          }

          if (isWeeklyFormat && rows.length >= 9) {
            if (rows[8] && rows[8][3]) {
              const dateVal = rows[8][3];
              try {
                let date: Date;
                if (typeof dateVal === 'number') {
                  date = XLSX.SSF.parse_date_code(dateVal);
                } else {
                  date = new Date(String(dateVal));
                }
                if (!isNaN(date.getTime())) {
                  const dayOfWeek = date.getDay();
                  const diff = dayOfWeek === 0 ? 0 : dayOfWeek;
                  const sunday = new Date(date);
                  sunday.setDate(date.getDate() - diff);
                  weekEndingDate = sunday.toISOString().split('T')[0];
                }
              } catch (err) {
                console.error('Date parsing error:', err);
              }
            }
          } else {
            if (rows[2] && rows[2][0]) {
              const dateStr = String(rows[2][0]);
              const dateMatch = dateStr.match(/As of\s+(.+?)(?:,\s*(\d{4}))?$/i);
              if (dateMatch) {
                const parsedDateStr = dateMatch[1].trim();
                const year = dateMatch[2];
                try {
                  const date = new Date(parsedDateStr + (year ? `, ${year}` : ''));
                  if (!isNaN(date.getTime())) {
                    const dayOfWeek = date.getDay();
                    const diff = dayOfWeek === 0 ? 0 : dayOfWeek;
                    const sunday = new Date(date);
                    sunday.setDate(date.getDate() - diff);
                    weekEndingDate = sunday.toISOString().split('T')[0];
                  }
                } catch (err) {
                  console.error('Date parsing error:', err);
                }
              }
            }
          }
        }

        if (isWeeklyFormat) {
          const result = parseWeeklyExcelFormat(rows, locationName);
          resolve({
            lineItems: result.weeks.length > 0 ? result.weeks[0].lineItems : [],
            errors: result.errors,
            locationName: result.locationName,
            weekEndingDate: result.weeks.length > 0 ? result.weeks[0].weekEndingDate : undefined,
            weeks: result.weeks
          });
          return;
        }

        let inCostOfProduct = false;
        let inCostOfLabour = false;
        let inRepairsMaintenance = false;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const firstCell = String(row[0] || '').trim();

          if (firstCell.includes('Cost Of Product')) {
            inCostOfProduct = true;
            inCostOfLabour = false;
            inRepairsMaintenance = false;
            continue;
          }
          if (firstCell.includes('Cost Of Labour')) {
            inCostOfLabour = true;
            inCostOfProduct = false;
            inRepairsMaintenance = false;
            continue;
          }
          if (firstCell.includes('Repairs & Maintenance')) {
            inRepairsMaintenance = true;
            inCostOfProduct = false;
            inCostOfLabour = false;
            continue;
          }
          if (firstCell.includes('Total ') || firstCell.includes('Expenses') || firstCell.includes('Fixed Charges')) {
            inCostOfProduct = false;
            inCostOfLabour = false;
            inRepairsMaintenance = false;
          }

          if (firstCell.includes('Total Sales - Food') && !foundItems.has('Food Sales')) {
            if (row.length >= 13) {
              const item: ParsedLineItem = {
                line_item_name: 'Food Sales',
                current_actual: parseNumber(row[1]),
                current_actual_pct: parsePercentage(row[2]),
                current_budget: parseNumber(row[3]),
                current_budget_pct: parsePercentage(row[4]),
                prior_year: parseNumber(row[5]),
                prior_year_pct: parsePercentage(row[6]),
                ytd_actual: parseNumber(row[7]),
                ytd_actual_pct: parsePercentage(row[8]),
                ytd_budget: parseNumber(row[9]),
                ytd_budget_pct: parsePercentage(row[10]),
                prior_ytd: parseNumber(row[11]),
                prior_ytd_pct: parsePercentage(row[12]),
                qtd_actual: null,
                qtd_actual_pct: null,
                qtd_budget: null,
                qtd_budget_pct: null
              };
              lineItems.push(item);
              foundItems.add('Food Sales');
            }
          }

          else if (firstCell === 'Total Sales') {
            if (row.length >= 13) {
              const item: ParsedLineItem = {
                line_item_name: 'Total Sales',
                current_actual: parseNumber(row[1]),
                current_actual_pct: parsePercentage(row[2]),
                current_budget: parseNumber(row[3]),
                current_budget_pct: parsePercentage(row[4]),
                prior_year: parseNumber(row[5]),
                prior_year_pct: parsePercentage(row[6]),
                ytd_actual: parseNumber(row[7]),
                ytd_actual_pct: parsePercentage(row[8]),
                ytd_budget: parseNumber(row[9]),
                ytd_budget_pct: parsePercentage(row[10]),
                prior_ytd: parseNumber(row[11]),
                prior_ytd_pct: parsePercentage(row[12]),
                qtd_actual: null,
                qtd_actual_pct: null,
                qtd_budget: null,
                qtd_budget_pct: null
              };
              lineItems.push(item);
              foundItems.add('Total Sales');
            }
          }

          else if (inCostOfProduct && firstCell === 'Food') {
            if (row.length >= 13) {
              const item: ParsedLineItem = {
                line_item_name: 'Cost of Sales (Food)',
                current_actual: parseNumber(row[1]),
                current_actual_pct: parsePercentage(row[2]),
                current_budget: parseNumber(row[3]),
                current_budget_pct: parsePercentage(row[4]),
                prior_year: parseNumber(row[5]),
                prior_year_pct: parsePercentage(row[6]),
                ytd_actual: parseNumber(row[7]),
                ytd_actual_pct: parsePercentage(row[8]),
                ytd_budget: parseNumber(row[9]),
                ytd_budget_pct: parsePercentage(row[10]),
                prior_ytd: parseNumber(row[11]),
                prior_ytd_pct: parsePercentage(row[12]),
                qtd_actual: null,
                qtd_actual_pct: null,
                qtd_budget: null,
                qtd_budget_pct: null
              };
              lineItems.push(item);
              foundItems.add('Cost of Sales (Food)');
            }
          }

          else if (inCostOfLabour && firstCell === 'Kitchen') {
            if (row.length >= 13) {
              const item: ParsedLineItem = {
                line_item_name: 'Kitchen Labour',
                current_actual: parseNumber(row[1]),
                current_actual_pct: parsePercentage(row[2]),
                current_budget: parseNumber(row[3]),
                current_budget_pct: parsePercentage(row[4]),
                prior_year: parseNumber(row[5]),
                prior_year_pct: parsePercentage(row[6]),
                ytd_actual: parseNumber(row[7]),
                ytd_actual_pct: parsePercentage(row[8]),
                ytd_budget: parseNumber(row[9]),
                ytd_budget_pct: parsePercentage(row[10]),
                prior_ytd: parseNumber(row[11]),
                prior_ytd_pct: parsePercentage(row[12]),
                qtd_actual: null,
                qtd_actual_pct: null,
                qtd_budget: null,
                qtd_budget_pct: null
              };
              lineItems.push(item);
              foundItems.add('Kitchen Labour');
            }
          }

          else if (firstCell === 'Kitchen Supplies') {
            if (row.length >= 13) {
              const item: ParsedLineItem = {
                line_item_name: 'Kitchen Supplies',
                current_actual: parseNumber(row[1]),
                current_actual_pct: parsePercentage(row[2]),
                current_budget: parseNumber(row[3]),
                current_budget_pct: parsePercentage(row[4]),
                prior_year: parseNumber(row[5]),
                prior_year_pct: parsePercentage(row[6]),
                ytd_actual: parseNumber(row[7]),
                ytd_actual_pct: parsePercentage(row[8]),
                ytd_budget: parseNumber(row[9]),
                ytd_budget_pct: parsePercentage(row[10]),
                prior_ytd: parseNumber(row[11]),
                prior_ytd_pct: parsePercentage(row[12]),
                qtd_actual: null,
                qtd_actual_pct: null,
                qtd_budget: null,
                qtd_budget_pct: null
              };
              lineItems.push(item);
              foundItems.add('Kitchen Supplies');
            }
          }

          else if (firstCell === 'Table and Dishware') {
            if (row.length >= 13) {
              const item: ParsedLineItem = {
                line_item_name: 'Table and Dishware',
                current_actual: parseNumber(row[1]),
                current_actual_pct: parsePercentage(row[2]),
                current_budget: parseNumber(row[3]),
                current_budget_pct: parsePercentage(row[4]),
                prior_year: parseNumber(row[5]),
                prior_year_pct: parsePercentage(row[6]),
                ytd_actual: parseNumber(row[7]),
                ytd_actual_pct: parsePercentage(row[8]),
                ytd_budget: parseNumber(row[9]),
                ytd_budget_pct: parsePercentage(row[10]),
                prior_ytd: parseNumber(row[11]),
                prior_ytd_pct: parsePercentage(row[12]),
                qtd_actual: null,
                qtd_actual_pct: null,
                qtd_budget: null,
                qtd_budget_pct: null
              };
              lineItems.push(item);
              foundItems.add('Table and Dishware');
            }
          }

          else if (firstCell === 'IHP Substandard Product') {
            if (row.length >= 13) {
              const item: ParsedLineItem = {
                line_item_name: 'IHP Substandard Product',
                current_actual: parseNumber(row[1]),
                current_actual_pct: parsePercentage(row[2]),
                current_budget: parseNumber(row[3]),
                current_budget_pct: parsePercentage(row[4]),
                prior_year: parseNumber(row[5]),
                prior_year_pct: parsePercentage(row[6]),
                ytd_actual: parseNumber(row[7]),
                ytd_actual_pct: parsePercentage(row[8]),
                ytd_budget: parseNumber(row[9]),
                ytd_budget_pct: parsePercentage(row[10]),
                prior_ytd: parseNumber(row[11]),
                prior_ytd_pct: parsePercentage(row[12]),
                qtd_actual: null,
                qtd_actual_pct: null,
                qtd_budget: null,
                qtd_budget_pct: null
              };
              lineItems.push(item);
              foundItems.add('IHP Substandard Product');
            }
          }

          else if (inRepairsMaintenance && firstCell === 'Equipment') {
            if (row.length >= 13) {
              const item: ParsedLineItem = {
                line_item_name: 'R&M Equipment',
                current_actual: parseNumber(row[1]),
                current_actual_pct: parsePercentage(row[2]),
                current_budget: parseNumber(row[3]),
                current_budget_pct: parsePercentage(row[4]),
                prior_year: parseNumber(row[5]),
                prior_year_pct: parsePercentage(row[6]),
                ytd_actual: parseNumber(row[7]),
                ytd_actual_pct: parsePercentage(row[8]),
                ytd_budget: parseNumber(row[9]),
                ytd_budget_pct: parsePercentage(row[10]),
                prior_ytd: parseNumber(row[11]),
                prior_ytd_pct: parsePercentage(row[12]),
                qtd_actual: null,
                qtd_actual_pct: null,
                qtd_budget: null,
                qtd_budget_pct: null
              };
              lineItems.push(item);
              foundItems.add('R&M Equipment');
            }
          }

          else if (firstCell === 'EBITDA') {
            if (row.length >= 13) {
              const item: ParsedLineItem = {
                line_item_name: 'EBITDA',
                current_actual: parseNumber(row[1]),
                current_actual_pct: parsePercentage(row[2]),
                current_budget: parseNumber(row[3]),
                current_budget_pct: parsePercentage(row[4]),
                prior_year: parseNumber(row[5]),
                prior_year_pct: parsePercentage(row[6]),
                ytd_actual: parseNumber(row[7]),
                ytd_actual_pct: parsePercentage(row[8]),
                ytd_budget: parseNumber(row[9]),
                ytd_budget_pct: parsePercentage(row[10]),
                prior_ytd: parseNumber(row[11]),
                prior_ytd_pct: parsePercentage(row[12]),
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

        resolve({ lineItems, errors, locationName, weekEndingDate });
      } catch (error) {
        resolve({
          lineItems: [],
          errors: [`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`]
        });
      }
    };

    reader.onerror = () => {
      resolve({
        lineItems: [],
        errors: ['Failed to read file']
      });
    };

    reader.readAsBinaryString(file);
  });
}
