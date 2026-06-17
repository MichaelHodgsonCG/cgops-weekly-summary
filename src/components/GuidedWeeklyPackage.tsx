import { useEffect, useState } from 'react';
import { ClipboardCheck, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const LOCATION_NAME = 'Test Package';
const TOTAL_STEPS = 2;
const FOOD_CLASSES = ['FOOD-ADD-ONS', 'FOOD-APPS', 'FOOD-DESSERTS', 'FOOD-ENTREES'];

type GuidedStep = 'start' | 'sales' | 'discounts';

type DailySales = {
  day: number;
  total: number;
};

type SalesParseResult = {
  dailyTotals: DailySales[];
  grandTotal: number;
};

const DISCOUNT_REASON_CATEGORIES = [
  { label: 'Guest Did Not Like', match: 'guest did not like s' },
  { label: 'Quality Issue', match: 'quality issue s' },
  { label: 'Slow', match: 'slow s' },
  { label: 'Steak Over/Under', match: 'steak over under s' },
];

type DiscountCategoryResult = {
  label: string;
  dailyCounts: number[];
  dailyAmounts: number[];
  totalCount: number;
  totalAmount: number;
};

type DiscountsParseResult = {
  days: number[];
  categories: DiscountCategoryResult[];
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

function parseExecutiveSummarySales(csvText: string): SalesParseResult {
  const lines = csvText.split(/\r?\n/);
  const sectionIndex = lines.findIndex((line) =>
    line.includes('ExecutiveSummaryWeekly_Sales')
  );

  if (sectionIndex === -1) {
    throw new Error('Could not find the Sales section in this report.');
  }

  const headerLine = parseCsvLine(lines[sectionIndex + 1]);
  const dayColumns = headerLine
    .map((col, idx) => ({ col, idx }))
    .filter(({ col }) => /^Day\d+_GrossSales$/.test(col));

  const dailyTotals: DailySales[] = dayColumns.map(({ col }) => ({
    day: Number(col.match(/^Day(\d+)_/)?.[1]),
    total: 0,
  }));

  let rowIndex = sectionIndex + 2;
  while (rowIndex < lines.length && lines[rowIndex].trim() !== '') {
    const row = parseCsvLine(lines[rowIndex]);
    const className = row[0];

    if (FOOD_CLASSES.includes(className)) {
      dayColumns.forEach(({ idx }, i) => {
        const value = parseFloat(row[idx]);
        if (!isNaN(value)) {
          dailyTotals[i].total += value;
        }
      });
    }

    rowIndex++;
  }

  const grandTotal = dailyTotals.reduce((sum, d) => sum + d.total, 0);

  return { dailyTotals, grandTotal };
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
  }));

  let rowIndex = sectionIndex + 2;
  while (rowIndex < lines.length && lines[rowIndex].trim() !== '') {
    const row = parseCsvLine(lines[rowIndex]);
    const rowDateStr = row[dateIdx];
    const reason = normalizeDiscountReason(row[discountIdx] ?? '');
    const amount = parseFloat(row[amountIdx]);

    const categoryIndex = DISCOUNT_REASON_CATEGORIES.findIndex((c) => c.match === reason);

    if (categoryIndex !== -1 && rowDateStr && !isNaN(amount)) {
      const rowDate = new Date(rowDateStr.split(' ')[0] + 'T00:00:00');
      const dayNumber = Math.round((rowDate.getTime() - fromDate.getTime()) / 86400000) + 1;
      const dayPos = days.indexOf(dayNumber);

      if (dayPos !== -1) {
        categories[categoryIndex].dailyCounts[dayPos] += 1;
        categories[categoryIndex].dailyAmounts[dayPos] += amount;
        categories[categoryIndex].totalCount += 1;
        categories[categoryIndex].totalAmount += amount;
      }
    }

    rowIndex++;
  }

  return { days, categories };
}

export function GuidedWeeklyPackage() {
  const [step, setStep] = useState<GuidedStep>('start');
  const [locationName, setLocationName] = useState(LOCATION_NAME);
  const [salesBudget, setSalesBudget] = useState('');
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [salesResult, setSalesResult] = useState<SalesParseResult | null>(null);
  const [salesError, setSalesError] = useState('');
  const [discountsFile, setDiscountsFile] = useState<File | null>(null);
  const [discountsResult, setDiscountsResult] = useState<DiscountsParseResult | null>(null);
  const [discountsError, setDiscountsError] = useState('');

  useEffect(() => {
    loadLocation();
  }, []);

  const loadLocation = async () => {
    const { data } = await supabase
      .from('locations')
      .select('name')
      .eq('name', LOCATION_NAME)
      .maybeSingle();

    if (data) {
      setLocationName(data.name);
    }
  };

  const handleSalesFileSelect = async (file: File) => {
    setSalesFile(file);
    setSalesError('');
    setSalesResult(null);

    try {
      const text = await file.text();
      const result = parseExecutiveSummarySales(text);
      setSalesResult(result);
    } catch (err) {
      setSalesError(err instanceof Error ? err.message : 'Failed to parse this report.');
    }
  };

  const handleDiscountsFileSelect = async (file: File) => {
    setDiscountsFile(file);
    setDiscountsError('');
    setDiscountsResult(null);

    try {
      const text = await file.text();
      const result = parseDiscountsReport(text);
      setDiscountsResult(result);
    } catch (err) {
      setDiscountsError(err instanceof Error ? err.message : 'Failed to parse this report.');
    }
  };

  if (step === 'sales') {
    return (
      <GuidedSalesStep
        salesBudget={salesBudget}
        onSalesBudgetChange={setSalesBudget}
        file={salesFile}
        result={salesResult}
        error={salesError}
        onFileSelect={handleSalesFileSelect}
        onBack={() => setStep('start')}
        onNext={() => setStep('discounts')}
      />
    );
  }

  if (step === 'discounts') {
    return (
      <GuidedDiscountsStep
        file={discountsFile}
        result={discountsResult}
        error={discountsError}
        onFileSelect={handleDiscountsFileSelect}
        onBack={() => setStep('sales')}
      />
    );
  }

  return (
    <GuidedPackageStart
      locationName={locationName}
      onStart={() => setStep('sales')}
    />
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

      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Restaurant</p>
          <p className="text-base font-semibold text-slate-800">{locationName}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Reporting Period</p>
          <p className="text-base font-semibold text-slate-800">P11 W2</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Due Date</p>
          <p className="text-base font-semibold text-slate-800">TBD</p>
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
        Welcome Chef. This guided workflow will walk you through each report required for your
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
  file,
  result,
  error,
  onFileSelect,
  onBack,
  onNext,
}: {
  salesBudget: string;
  onSalesBudgetChange: (value: string) => void;
  file: File | null;
  result: SalesParseResult | null;
  error: string;
  onFileSelect: (file: File) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const stepNumber = 1;

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>Step {stepNumber} of {TOTAL_STEPS}</span>
        <span>{Math.round((stepNumber / TOTAL_STEPS) * 100)}%</span>
      </div>
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-slate-800 rounded-full"
          style={{ width: `${(stepNumber / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <h2 className="text-xl font-bold text-slate-800">Step 1: Sales</h2>

      <div className="mt-6">
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

      <div className="mt-8">
        <h3 className="text-base font-semibold text-slate-800">Upload Sales Report</h3>
        <p className="text-sm text-slate-600 mt-1">
          Executive Summary Weekly &gt; Select End Date &gt; Down to CSV &gt; Upload below
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
          <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {result.dailyTotals.map((d) => (
                    <th key={d.day} className="px-3 py-2 text-right font-medium text-slate-500">
                      Day {d.day}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200">
                  {result.dailyTotals.map((d) => (
                    <td key={d.day} className="px-3 py-2 text-right text-slate-700">
                      {d.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">
                    {result.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
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

function GuidedDiscountsStep({
  file,
  result,
  error,
  onFileSelect,
  onBack,
}: {
  file: File | null;
  result: DiscountsParseResult | null;
  error: string;
  onFileSelect: (file: File) => void;
  onBack: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const stepNumber = 2;

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>Step {stepNumber} of {TOTAL_STEPS}</span>
        <span>{Math.round((stepNumber / TOTAL_STEPS) * 100)}%</span>
      </div>
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-slate-800 rounded-full"
          style={{ width: `${(stepNumber / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <h2 className="text-xl font-bold text-slate-800">Step 2: Discounts</h2>

      <div className="mt-6">
        <h3 className="text-base font-semibold text-slate-800">Upload Discounts Report</h3>
        <p className="text-sm text-slate-600 mt-1">
          Loss Prevention &gt; Discounts &gt; Select Dates &gt; Select Major Classes:
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
