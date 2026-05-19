import { useState, useEffect, useCallback } from 'react';
import { FileText, Loader2, Download, Sparkles, Calendar, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCurrentFiscalPeriod, useFiscalCalendar } from '../lib/useFiscalCalendar';
import { ChefSummariesTable } from './ChefSummariesTable';

type WeeklyReport = {
  id: string;
  fiscal_year: number;
  period_number: number;
  week_number: number;
  executive_summary: string;
  beertown_summary: string;
  trinity_summary: string;
  sole_summary: string;
  action_plan: string;
  consolidated_metrics: any;
  status: 'draft' | 'final';
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
};

type ConsolidatedMetrics = {
  totalSales: number;
  foodCostPct: number;
  labourCostPct: number;
  ebitdaPct: number;
  locationCount: number;
};

interface WeeklyExecutiveReportProps {
  fiscalYear?: number;
  period?: number;
  week?: number;
}

export default function WeeklyExecutiveReport({ fiscalYear: propFiscalYear, period: propPeriod, week: propWeek }: WeeklyExecutiveReportProps = {}) {
  const { currentPeriod: hookCurrentPeriod, loading: fiscalLoading } = useCurrentFiscalPeriod();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'report' | 'summaries' | 'journals'>('report');

  const isUsingProps = !!(propFiscalYear && propPeriod && propWeek);

  const currentPeriod = isUsingProps
    ? { fiscal_year: propFiscalYear!, period: propPeriod!, week: propWeek!, id: '', start_date: '', end_date: '', is_current: false }
    : hookCurrentPeriod;

  const selectedYear = currentPeriod?.fiscal_year || 2026;
  const { weeks } = useFiscalCalendar(selectedYear);

  const calculateConsolidatedMetrics = useCallback(async (): Promise<ConsolidatedMetrics> => {
    if (!currentPeriod || weeks.length === 0) {
      return {
        totalSales: 0,
        foodCostPct: 0,
        labourCostPct: 0,
        ebitdaPct: 0,
        locationCount: 0
      };
    }

    const ptdWeeks = weeks.filter(w => w.period === currentPeriod.period && w.week <= currentPeriod.week);

    const { data: allSummaries } = await supabase
      .from('weekly_chef_summary')
      .select('*, locations!inner(*)')
      .eq('fiscal_year', currentPeriod.fiscal_year)
      .eq('locations.exclude_from_reporting', false);

    if (!allSummaries) {
      return {
        totalSales: 0,
        foodCostPct: 0,
        labourCostPct: 0,
        ebitdaPct: 0,
        locationCount: 0
      };
    }

    const ptdSummaries = allSummaries.filter(s =>
      ptdWeeks.some(w => s.period_number === w.period && s.week_number === w.week)
    );

    if (ptdSummaries.length === 0) {
      return {
        totalSales: 0,
        foodCostPct: 0,
        labourCostPct: 0,
        ebitdaPct: 0,
        locationCount: 0
      };
    }

    const totalSales = ptdSummaries.reduce((sum, s) =>
      sum + Number(s.sage_food_sales_qtd || 0) + Number(s.food_sales_silverware || 0) + Number(s.food_sales_oc || 0), 0);
    const totalFoodCost = ptdSummaries.reduce((sum, s) => sum + Number(s.usage_amount || 0), 0);
    const totalLabourCost = ptdSummaries.reduce((sum, s) => sum + Number(s.labour_spent || 0), 0);

    const foodCostPct = totalSales > 0 ? (totalFoodCost / totalSales) * 100 : 0;
    const labourCostPct = totalSales > 0 ? (totalLabourCost / totalSales) * 100 : 0;

    const uniqueLocations = new Set(ptdSummaries.map(s => s.location_id));

    return {
      totalSales,
      foodCostPct,
      labourCostPct,
      ebitdaPct: 0,
      locationCount: uniqueLocations.size
    };
  }, [currentPeriod?.fiscal_year, currentPeriod?.period, currentPeriod?.week, weeks]);

  const loadOrCreateReport = useCallback(async () => {
    if (!currentPeriod) return;

    setLoading(true);

    const { data: existingReport } = await supabase
      .from('weekly_executive_reports')
      .select('*')
      .eq('fiscal_year', currentPeriod.fiscal_year)
      .eq('period_number', currentPeriod.period)
      .eq('week_number', currentPeriod.week)
      .maybeSingle();

    if (existingReport) {
      setReport(existingReport);
    } else {
      const metrics = await calculateConsolidatedMetrics();
      const { data: newReport, error } = await supabase
        .from('weekly_executive_reports')
        .insert({
          fiscal_year: currentPeriod.fiscal_year,
          period_number: currentPeriod.period,
          week_number: currentPeriod.week,
          consolidated_metrics: metrics,
          status: 'draft'
        })
        .select()
        .single();

      if (!error && newReport) {
        setReport(newReport);
      }
    }

    setLoading(false);
  }, [currentPeriod?.fiscal_year, currentPeriod?.period, currentPeriod?.week, calculateConsolidatedMetrics]);

  useEffect(() => {
    if (isUsingProps && propFiscalYear && propPeriod && propWeek) {
      loadOrCreateReport();
    } else if (!isUsingProps && hookCurrentPeriod) {
      loadOrCreateReport();
    }
  }, [propFiscalYear, propPeriod, propWeek, hookCurrentPeriod?.fiscal_year, hookCurrentPeriod?.period, hookCurrentPeriod?.week, isUsingProps, loadOrCreateReport]);

  const handleFieldChange = async (field: keyof WeeklyReport, value: string) => {
    if (!report) return;

    const updatedReport = { ...report, [field]: value };
    setReport(updatedReport);

    setSaving(true);
    const { error } = await supabase
      .from('weekly_executive_reports')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', report.id);

    setSaving(false);

    if (error) {
      showMessage('error', 'Failed to save changes');
    } else {
      showMessage('success', 'Saved');
    }
  };

  const generateWithAI = async (section: string) => {
    if (!report || !currentPeriod) return;

    setGenerating(section);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-executive-summary`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            reportId: report.id,
            section,
            fiscalYear: currentPeriod.fiscal_year,
            period: currentPeriod.period,
            week: currentPeriod.week
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const result = await response.json();

      if (result.content) {
        await handleFieldChange(section as keyof WeeklyReport, result.content);
        showMessage('success', 'AI summary generated successfully');
      }
    } catch (error) {
      console.error('Error generating AI summary:', error);
      showMessage('error', 'Failed to generate AI summary');
    } finally {
      setGenerating(null);
    }
  };

  const exportReport = async () => {
    if (!currentPeriod) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-executive-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            fiscalYear: currentPeriod.fiscal_year,
            period: currentPeriod.period,
            week: currentPeriod.week
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `executive-report-fy${currentPeriod.fiscal_year}-p${currentPeriod.period}-w${currentPeriod.week}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showMessage('success', 'Report exported successfully');
    } catch (error) {
      console.error('Error exporting report:', error);
      showMessage('error', 'Failed to export report');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  if ((fiscalLoading && !isUsingProps) || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!currentPeriod && !isUsingProps) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-600">No fiscal calendar data available. Please configure the fiscal calendar in Admin settings.</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-800 mb-2">No Report Available</h3>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">
          Generate an executive report for Period {currentPeriod?.period} Week {currentPeriod?.week} to consolidate financial metrics and insights across all locations.
        </p>
        <button
          onClick={loadOrCreateReport}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Report...
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              Create Report
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Weekly Executive Report</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-slate-600">
            <Calendar className="w-4 h-4" />
            <span>FY {currentPeriod?.fiscal_year} - Period {currentPeriod?.period}, Week {currentPeriod?.week}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </span>
          )}

          {message && (
            <span className={`text-sm flex items-center gap-2 ${
              message.type === 'success' ? 'text-green-600' : 'text-red-600'
            }`}>
              {message.type === 'success' && <Check className="w-4 h-4" />}
              {message.text}
            </span>
          )}

          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'report'
                ? 'border-slate-800 text-slate-800'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 inline-block mr-2" />
            Executive Report
          </button>
          <button
            onClick={() => setActiveTab('summaries')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'summaries'
                ? 'border-slate-800 text-slate-800'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            Summaries Table
          </button>
          <button
            onClick={() => setActiveTab('journals')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'journals'
                ? 'border-slate-800 text-slate-800'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            Journals
          </button>
        </nav>
      </div>

      {activeTab === 'report' && (
        <RestaurantMetricsList fiscalYear={currentPeriod!.fiscal_year} period={currentPeriod!.period} week={currentPeriod!.week} />
      )}

      {activeTab === 'summaries' && (
        <ChefSummariesTable fiscalYear={currentPeriod!.fiscal_year} period={currentPeriod!.period} week={currentPeriod!.week} />
      )}

      {activeTab === 'journals' && (
        <JournalsTable fiscalYear={currentPeriod!.fiscal_year} period={currentPeriod!.period} week={currentPeriod!.week} />
      )}
    </div>
  );
}

function RestaurantMetricsList({ fiscalYear, period, week }: { fiscalYear: number; period: number; week: number }) {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRestaurantData();
  }, [fiscalYear, period, week]);

  const getQuarterPeriods = (p: number): number[] => {
    if (p <= 3) return [1, 2, 3];
    if (p <= 6) return [4, 5, 6];
    if (p <= 9) return [7, 8, 9];
    return [10, 11, 12, 13];
  };

  const loadRestaurantData = async () => {
    setLoading(true);

    const quarterPeriods = getQuarterPeriods(period);

    const { data: fiscalData } = await supabase
      .from('fiscal_calendar')
      .select('end_date, period, week')
      .eq('fiscal_year', fiscalYear)
      .eq('period', period)
      .eq('week', week)
      .single();

    const weekEndingDate = fiscalData?.end_date;

    const { data: quarterCalWeeks } = await supabase
      .from('fiscal_calendar')
      .select('end_date, period, week')
      .eq('fiscal_year', fiscalYear)
      .in('period', quarterPeriods)
      .order('period', { ascending: true })
      .order('week', { ascending: true });

    const qtdEndDates = (quarterCalWeeks || [])
      .filter(w => w.period < period || (w.period === period && w.week <= week))
      .map(w => w.end_date);

    const { data: currentWeekData } = await supabase
      .from('weekly_chef_summary')
      .select('*, locations!inner(*)')
      .eq('fiscal_year', fiscalYear)
      .eq('period_number', period)
      .eq('week_number', week)
      .eq('locations.exclude_from_reporting', false)
      .order('locations(code)');

    const { data: plData } = weekEndingDate ? await supabase
      .from('pl_line_items')
      .select('*, locations!inner(*)')
      .eq('week_ending_date', weekEndingDate)
      .eq('locations.exclude_from_reporting', false)
      : { data: null };

    const { data: qtdPLDataRaw } = qtdEndDates.length > 0 ? await supabase
      .from('pl_line_items')
      .select('location_id, line_item_name, current_actual, current_budget, week_ending_date')
      .in('week_ending_date', qtdEndDates)
      .eq('line_item_name', 'Food Sales')
      : { data: null };

    const qtdByLocation = new Map<string, { qtdSales: number; qtdBudget: number }>();
    if (qtdPLDataRaw && quarterCalWeeks) {
      const locationIds = [...new Set(qtdPLDataRaw.map(pl => pl.location_id))];
      for (const locId of locationIds) {
        const locItems = qtdPLDataRaw.filter(pl => pl.location_id === locId);
        let totalSales = 0;
        let totalBudget = 0;

        const periodsInQtd = [...new Set(qtdEndDates.map(d => {
          const cal = quarterCalWeeks.find(c => c.end_date === d);
          return cal?.period;
        }).filter(Boolean))] as number[];

        for (const p of periodsInQtd) {
          const periodEndDates = quarterCalWeeks
            .filter(c => c.period === p)
            .map(c => c.end_date)
            .filter(d => qtdEndDates.includes(d));

          const periodItems = locItems
            .filter(pl => periodEndDates.includes(pl.week_ending_date))
            .sort((a, b) => a.week_ending_date.localeCompare(b.week_ending_date));

          if (periodItems.length > 0) {
            const latest = periodItems[periodItems.length - 1];
            totalSales += latest.current_actual || 0;
            totalBudget += latest.current_budget || 0;
          }
        }

        qtdByLocation.set(locId, { qtdSales: totalSales, qtdBudget: totalBudget });
      }
    }

    if (currentWeekData) {
      const restaurantMetrics = currentWeekData.map(current => {
        const weekSales = current.food_sales_silverware || 0;

        const locationPL = plData?.filter(pl => pl.location_id === current.location_id) || [];
        const foodSalesPL = locationPL.find(pl => pl.line_item_name === 'Food Sales');

        const weekBudgetPeriod = foodSalesPL?.current_budget || current.budget_food_sales_period || 0;
        const computedWeekBudget = weekBudgetPeriod > 0 ? weekBudgetPeriod / 4 : 0;
        const weekSalesVariance = weekSales > 0 ? weekSales - computedWeekBudget : 0;

        const locQtd = qtdByLocation.get(current.location_id);
        const qtdSales = locQtd ? locQtd.qtdSales : (current.sage_food_sales_qtd || 0);
        const qtdBudget = locQtd ? locQtd.qtdBudget : (current.sage_sales_budget_qtd || 0);
        const qtdSalesVariance = qtdSales - qtdBudget;

        const foodCostPL = locationPL.find(pl => pl.line_item_name === 'Cost of Sales (Food)');
        const labourPL = locationPL.find(pl => pl.line_item_name === 'Kitchen Labour' || pl.line_item_name === 'Labour');

        const weekFoodCost = current.actual_food_cost_pct || 0;
        const weekBudgetFoodCost = current.budget_food_cost_pct || 0;
        const weekFoodCostVariance = weekFoodCost - weekBudgetFoodCost;
        const weekFoodCostVarianceDollar = (weekSales * weekFoodCostVariance) / 100;

        const ptdFoodCost = foodCostPL?.current_actual_pct || current.food_cost_ptd_pct || 0;
        const ptdBudgetFoodCost = foodCostPL?.current_budget_pct || current.budget_food_cost_pct || 0;
        const ptdFoodCostVariance = ptdFoodCost - ptdBudgetFoodCost;
        const ptdFoodCostVarianceDollar = (qtdSales * ptdFoodCostVariance) / 100;

        const weekLabour = current.labour_cost_pct || 0;
        const weekBudgetLabour = current.labour_budget_pct || 0;
        const weekLabourVariance = weekLabour - weekBudgetLabour;
        const weekLabourVarianceDollar = (weekSales * weekLabourVariance) / 100;

        const ptdLabour = labourPL?.current_actual_pct || current.labour_cost_ptd_pct || 0;
        const ptdBudgetLabour = labourPL?.current_budget_pct || current.labour_budget_pct || 0;
        const ptdLabourVariance = ptdLabour - ptdBudgetLabour;
        const ptdLabourVarianceDollar = (qtdSales * ptdLabourVariance) / 100;

        const weekTheoreticalFoodCost = current.theoretical_food_cost_pct || 0;
        const weekTheoreticalVariance = weekFoodCost - weekTheoreticalFoodCost;

        const ptdTheoreticalFoodCost = current.theoretical_food_cost_pct || 0;
        const ptdTheoreticalVariance = ptdFoodCost - ptdTheoreticalFoodCost;

        const weekPromo = current.boh_promo_amount || 0;
        const ptdPromo = current.promo_ptd || 0;

        const expoTime = current.qsr_expo_time || '';
        const brunchTime = current.qsr_weekend_lunch_time || '';

        const ytdSales = foodSalesPL?.ytd_actual || 0;
        const ytdSalesBudget = foodSalesPL?.ytd_budget || 0;
        const ytdSalesVariance = ytdSales - ytdSalesBudget;

        const ytdFoodCostPct = foodCostPL?.ytd_actual_pct || 0;
        const ytdFoodCostBudgetPct = foodCostPL?.ytd_budget_pct || 0;
        const ytdFoodCostVariance = ytdFoodCostPct - ytdFoodCostBudgetPct;

        const ytdLabourPct = labourPL?.ytd_actual_pct || 0;
        const ytdLabourBudgetPct = labourPL?.ytd_budget_pct || 0;
        const ytdLabourVariance = ytdLabourPct - ytdLabourBudgetPct;

        return {
          name: current.locations.name,
          code: current.locations.code,
          weekSales,
          weekSalesVariance,
          qtdSales,
          qtdSalesVariance,
          ytdSales,
          ytdSalesVariance,
          weekFoodCost,
          weekFoodCostVariance,
          weekFoodCostVarianceDollar,
          ptdFoodCost,
          ptdFoodCostVariance,
          ptdFoodCostVarianceDollar,
          ytdFoodCostPct,
          ytdFoodCostVariance,
          weekTheoreticalVariance,
          ptdTheoreticalVariance,
          weekLabour,
          weekLabourVariance,
          weekLabourVarianceDollar,
          ptdLabour,
          ptdLabourVariance,
          ptdLabourVarianceDollar,
          ytdLabourPct,
          ytdLabourVariance,
          weekPromo,
          ptdPromo,
          expoTime,
          brunchTime,
          aiSummary: current.ai_summary
        };
      });

      setRestaurants(restaurantMetrics);
    }

    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return `$${Math.round(value).toLocaleString()}`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatVariance = (value: number, isCurrency: boolean = false) => {
    const sign = value >= 0 ? '+' : '–';
    const absValue = Math.abs(value);
    if (isCurrency) {
      return `(${sign}${formatCurrency(absValue)})`;
    }
    return `(${sign}${absValue.toFixed(2)} pts)`;
  };

  const getVarianceColor = (variance: number, higherIsBad: boolean = true) => {
    if (higherIsBad) {
      return variance > 0 ? 'text-red-600' : variance < 0 ? 'text-green-600' : 'text-slate-900';
    } else {
      return variance < 0 ? 'text-red-600' : variance > 0 ? 'text-green-600' : 'text-slate-900';
    }
  };

  const parseTimeToMinutes = (timeStr: string): { hours: number; minutes: number } | null => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d+):(\d+)/);
    if (match) {
      return {
        hours: parseInt(match[1]),
        minutes: parseInt(match[2])
      };
    }
    return null;
  };

  const shouldHighlightTime = (timeStr: string, restaurantCode: string, isBrunchTime: boolean = false): boolean => {
    const time = parseTimeToMinutes(timeStr);
    if (time === null) return false;

    if (isBrunchTime) {
      return time.hours > 10 || (time.hours === 10 && time.minutes > 0);
    }

    if (restaurantCode === 'BTBA' || restaurantCode === 'SKT') {
      return time.hours >= 10;
    }
    return time.hours >= 12;
  };

  const shouldHighlightPromo = (promoAmount: number, weekSales: number): boolean => {
    if (weekSales === 0) return false;
    const promoPercent = (promoAmount / weekSales) * 100;
    return promoPercent > 0.25;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-2" />
        <p className="text-slate-600">Loading restaurant metrics...</p>
      </div>
    );
  }

  const formatVarianceCellValue = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${formatCurrency(value)}`;
  };

  const formatVariancePercentValue = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const getVarianceCellColor = (variance: number) => {
    if (variance > 0) return 'text-red-600 font-semibold';
    if (variance < 0) return 'text-green-600 font-semibold';
    return 'text-slate-600';
  };

  const getTheoreticalVarianceCellColor = (variance: number) => {
    const absVariance = Math.abs(variance);
    if (absVariance <= 0.5) return 'text-green-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  return (
    <div className="space-y-6">
      <ConsolidatedSummaries fiscalYear={fiscalYear} period={period} week={week} />

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Budget Variance Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider bg-slate-100 sticky left-0 min-w-[200px]">
                  Metric
                </th>
                {restaurants.map((restaurant, index) => (
                  <th key={index} className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap bg-slate-100">
                    {restaurant.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="hover:bg-slate-50">
                <td className="px-6 py-3 text-sm font-medium text-slate-700 bg-slate-50 sticky left-0 min-w-[200px]">
                  Food Cost +/- Budget $ Week
                </td>
                {restaurants.map((restaurant, index) => (
                  <td key={index} className={`px-4 py-3 text-sm text-center ${getVarianceCellColor(restaurant.weekFoodCostVarianceDollar)}`}>
                    {formatVarianceCellValue(restaurant.weekFoodCostVarianceDollar)}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-6 py-3 text-sm font-medium text-slate-700 bg-slate-50 sticky left-0 min-w-[200px]">
                  Food Cost +/- Budget $ Period
                </td>
                {restaurants.map((restaurant, index) => (
                  <td key={index} className={`px-4 py-3 text-sm text-center ${getVarianceCellColor(restaurant.ptdFoodCostVarianceDollar)}`}>
                    {formatVarianceCellValue(restaurant.ptdFoodCostVarianceDollar)}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-6 py-3 text-sm font-medium text-slate-700 bg-slate-50 sticky left-0 min-w-[200px]">
                  Food Cost vs Theoretical % Week
                </td>
                {restaurants.map((restaurant, index) => (
                  <td key={index} className={`px-4 py-3 text-sm text-center ${getTheoreticalVarianceCellColor(restaurant.weekTheoreticalVariance)}`}>
                    {formatVariancePercentValue(restaurant.weekTheoreticalVariance)}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-6 py-3 text-sm font-medium text-slate-700 bg-slate-50 sticky left-0 min-w-[200px]">
                  Food Cost vs Theoretical % Period
                </td>
                {restaurants.map((restaurant, index) => (
                  <td key={index} className={`px-4 py-3 text-sm text-center ${getTheoreticalVarianceCellColor(restaurant.ptdTheoreticalVariance)}`}>
                    {formatVariancePercentValue(restaurant.ptdTheoreticalVariance)}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-6 py-3 text-sm font-medium text-slate-700 bg-slate-50 sticky left-0 min-w-[200px]">
                  Labour Cost +/- Budget $ Week
                </td>
                {restaurants.map((restaurant, index) => (
                  <td key={index} className={`px-4 py-3 text-sm text-center ${getVarianceCellColor(restaurant.weekLabourVarianceDollar)}`}>
                    {formatVarianceCellValue(restaurant.weekLabourVarianceDollar)}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-6 py-3 text-sm font-medium text-slate-700 bg-slate-50 sticky left-0 min-w-[200px]">
                  Labour Cost +/- Budget $ Period
                </td>
                {restaurants.map((restaurant, index) => (
                  <td key={index} className={`px-4 py-3 text-sm text-center ${getVarianceCellColor(restaurant.ptdLabourVarianceDollar)}`}>
                    {formatVarianceCellValue(restaurant.ptdLabourVarianceDollar)}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-6 py-3 text-sm font-medium text-slate-700 bg-slate-50 sticky left-0 min-w-[200px]">
                  Promos $ Week
                </td>
                {restaurants.map((restaurant, index) => (
                  <td key={index} className={`px-4 py-3 text-sm text-center ${shouldHighlightPromo(restaurant.weekPromo, restaurant.weekSales) ? 'text-red-600 font-semibold' : 'text-slate-700'}`}>
                    {formatCurrency(restaurant.weekPromo)}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-6 py-3 text-sm font-medium text-slate-700 bg-slate-50 sticky left-0 min-w-[200px]">
                  Promos $ Period
                </td>
                {restaurants.map((restaurant, index) => (
                  <td key={index} className="px-4 py-3 text-sm text-center text-slate-700">
                    {formatCurrency(restaurant.ptdPromo)}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-6 py-3 text-sm font-medium text-slate-700 bg-slate-50 sticky left-0 min-w-[200px]">
                  Expo Time
                </td>
                {restaurants.map((restaurant, index) => (
                  <td key={index} className={`px-4 py-3 text-sm text-center ${shouldHighlightTime(restaurant.expoTime, restaurant.code) ? 'text-red-600 font-semibold' : 'text-slate-700'}`}>
                    {restaurant.expoTime}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-6 py-3 text-sm font-medium text-slate-700 bg-slate-50 sticky left-0 min-w-[200px]">
                  Brunch Time
                </td>
                {restaurants.map((restaurant, index) => (
                  <td key={index} className={`px-4 py-3 text-sm text-center ${shouldHighlightTime(restaurant.brunchTime, restaurant.code, true) ? 'text-red-600 font-semibold' : 'text-slate-700'}`}>
                    {restaurant.brunchTime}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-6">Restaurant Performance using P&L data</h2>
        <div className="space-y-6">
          {restaurants.map((restaurant, index) => (
            <div key={index} className="border-b border-slate-200 pb-6 last:border-b-0">
              <h3 className="font-semibold text-slate-800 mb-3">{restaurant.name}</h3>
              <div className="space-y-2 text-sm mb-4">
                <div>
                  <span className="text-slate-700">Food Sales: </span>
                  <span className="text-slate-900">
                    Week {formatCurrency(restaurant.weekSales)} <span className={getVarianceColor(restaurant.weekSalesVariance, false)}>{formatVariance(restaurant.weekSalesVariance, true)}</span> | QTD {formatCurrency(restaurant.qtdSales)} <span className={getVarianceColor(restaurant.qtdSalesVariance, false)}>{formatVariance(restaurant.qtdSalesVariance, true)}</span> | YTD {formatCurrency(restaurant.ytdSales)} <span className={getVarianceColor(restaurant.ytdSalesVariance, false)}>{formatVariance(restaurant.ytdSalesVariance, true)}</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-700">Food Cost: </span>
                  <span className="text-slate-900">
                    {formatPercent(restaurant.weekFoodCost)} <span className={getVarianceColor(restaurant.weekFoodCostVariance, true)}>{formatVariance(restaurant.weekFoodCostVariance)}</span> | PTD {formatPercent(restaurant.ptdFoodCost)} <span className={getVarianceColor(restaurant.ptdFoodCostVariance, true)}>{formatVariance(restaurant.ptdFoodCostVariance)}</span> | YTD {formatPercent(restaurant.ytdFoodCostPct)} <span className={getVarianceColor(restaurant.ytdFoodCostVariance, true)}>{formatVariance(restaurant.ytdFoodCostVariance)}</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-700">Labour: </span>
                  <span className="text-slate-900">
                    {formatPercent(restaurant.weekLabour)} <span className={getVarianceColor(restaurant.weekLabourVariance, true)}>{formatVariance(restaurant.weekLabourVariance)}</span> | PTD {formatPercent(restaurant.ptdLabour)} <span className={getVarianceColor(restaurant.ptdLabourVariance, true)}>{formatVariance(restaurant.ptdLabourVariance)}</span> | YTD {formatPercent(restaurant.ytdLabourPct)} <span className={getVarianceColor(restaurant.ytdLabourVariance, true)}>{formatVariance(restaurant.ytdLabourVariance)}</span>
                  </span>
                </div>
              </div>
              {restaurant.aiSummary && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-700 leading-relaxed">{restaurant.aiSummary}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConsolidatedSummaries({ fiscalYear, period, week }: { fiscalYear: number; period: number; week: number }) {
  const [metrics, setMetrics] = useState<{
    allRestaurants: any;
    beertownSociable: any;
    trinity: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [fiscalYear, period, week]);

  const loadMetrics = async () => {
    setLoading(true);

    const { data: fiscalData } = await supabase
      .from('fiscal_calendar')
      .select('end_date')
      .eq('fiscal_year', fiscalYear)
      .eq('period', period)
      .eq('week', week)
      .single();

    if (!fiscalData) {
      setLoading(false);
      return;
    }

    const weekEndingDate = fiscalData.end_date;

    const { data: plData } = await supabase
      .from('pl_line_items')
      .select('*, locations!inner(*)')
      .eq('week_ending_date', weekEndingDate)
      .eq('locations.exclude_from_reporting', false);

    if (!plData || plData.length === 0) {
      setLoading(false);
      return;
    }

    const getLineItemValue = (locationId: string, lineItemName: string, field: string): number => {
      const item = plData.find(pl => pl.location_id === locationId && pl.line_item_name === lineItemName);
      return item ? (parseFloat(item[field]) || 0) : 0;
    };

    const calculateMetrics = (locationCodes: string[]) => {
      const filteredPL = plData.filter(pl => locationCodes.includes(pl.locations.code));
      const locationIds = [...new Set(filteredPL.map(pl => pl.location_id))];

      // PTD (Period-to-Date) metrics - from current_actual and current_budget
      const ptdSales = locationIds.reduce((sum, locId) => sum + getLineItemValue(locId, 'Food Sales', 'current_actual'), 0);
      const ptdBudget = locationIds.reduce((sum, locId) => sum + getLineItemValue(locId, 'Food Sales', 'current_budget'), 0);
      const ptdSalesVariance = ptdSales - ptdBudget;

      // YTD (Year-to-Date) metrics - from ytd_actual and ytd_budget
      const ytdSales = locationIds.reduce((sum, locId) => sum + getLineItemValue(locId, 'Food Sales', 'ytd_actual'), 0);
      const ytdBudget = locationIds.reduce((sum, locId) => sum + getLineItemValue(locId, 'Food Sales', 'ytd_budget'), 0);
      const ytdSalesVariance = ytdSales - ytdBudget;

      // WTD (Week-to-Date) metrics - use PTD for consolidated view (should calculate from weekly values)
      const wtdSales = ptdSales;
      const wtdSalesVariance = ptdSalesVariance;

      const ptdFoodCost = locationIds.reduce((sum, locId) => sum + getLineItemValue(locId, 'Cost of Sales (Food)', 'current_actual'), 0);
      const ptdFoodCostPct = ptdSales > 0 ? (ptdFoodCost / ptdSales) * 100 : 0;
      const ptdFoodCostBudget = locationIds.reduce((sum, locId) => sum + getLineItemValue(locId, 'Cost of Sales (Food)', 'current_budget'), 0);
      const ptdFoodCostBudgetPct = ptdBudget > 0 ? (ptdFoodCostBudget / ptdBudget) * 100 : 0;
      const ptdFoodCostVariance = ptdFoodCostPct - ptdFoodCostBudgetPct;

      const ytdFoodCost = locationIds.reduce((sum, locId) => sum + getLineItemValue(locId, 'Cost of Sales (Food)', 'ytd_actual'), 0);
      const ytdFoodCostPct = ytdSales > 0 ? (ytdFoodCost / ytdSales) * 100 : 0;
      const ytdFoodCostBudget = locationIds.reduce((sum, locId) => sum + getLineItemValue(locId, 'Cost of Sales (Food)', 'ytd_budget'), 0);
      const ytdFoodCostBudgetPct = ytdBudget > 0 ? (ytdFoodCostBudget / ytdBudget) * 100 : 0;
      const ytdFoodCostVariance = ytdFoodCostPct - ytdFoodCostBudgetPct;

      // WTD Food Cost - calculated from P&L using PTD values
      const wtdFoodCostPct = ptdFoodCostPct;
      const wtdFoodCostVariance = ptdFoodCostVariance;

      // PTD Labour from P&L
      const ptdLabour = locationIds.reduce((sum, locId) => sum + getLineItemValue(locId, 'Kitchen Labour', 'current_actual'), 0);
      const ptdLabourPct = ptdSales > 0 ? (ptdLabour / ptdSales) * 100 : 0;
      const ptdLabourBudget = locationIds.reduce((sum, locId) => sum + getLineItemValue(locId, 'Kitchen Labour', 'current_budget'), 0);
      const ptdLabourBudgetPct = ptdBudget > 0 ? (ptdLabourBudget / ptdBudget) * 100 : 0;
      const ptdLabourVariance = ptdLabourPct - ptdLabourBudgetPct;

      // YTD Labour from P&L
      const ytdLabour = locationIds.reduce((sum, locId) => sum + getLineItemValue(locId, 'Kitchen Labour', 'ytd_actual'), 0);
      const ytdLabourPct = ytdSales > 0 ? (ytdLabour / ytdSales) * 100 : 0;
      const ytdLabourBudget = locationIds.reduce((sum, locId) => sum + getLineItemValue(locId, 'Kitchen Labour', 'ytd_budget'), 0);
      const ytdLabourBudgetPct = ytdBudget > 0 ? (ytdLabourBudget / ytdBudget) * 100 : 0;
      const ytdLabourVariance = ytdLabourPct - ytdLabourBudgetPct;

      // WTD Labour - calculated from P&L using PTD values
      const wtdLabourPct = ptdLabourPct;
      const wtdLabourVariance = ptdLabourVariance;

      return {
        wtdSales,
        wtdSalesVariance,
        ptdSales,
        ptdSalesVariance,
        ytdSales,
        ytdSalesVariance,
        wtdFoodCostPct,
        wtdFoodCostVariance,
        ptdFoodCostPct,
        ptdFoodCostVariance,
        ytdFoodCostPct,
        ytdFoodCostVariance,
        wtdLabourPct,
        wtdLabourVariance,
        ptdLabourPct,
        ptdLabourVariance,
        ytdLabourPct,
        ytdLabourVariance
      };
    };

    const allLocationCodes = [...new Set(plData.map(pl => pl.locations.code))];
    const beertownSociableCodes = allLocationCodes.filter(code => code.startsWith('BT') || code === 'SKT');
    const trinityCodes = allLocationCodes.filter(code => ['WC', 'TBK', 'SOLE'].includes(code));

    setMetrics({
      allRestaurants: calculateMetrics(allLocationCodes),
      beertownSociable: calculateMetrics(beertownSociableCodes),
      trinity: calculateMetrics(trinityCodes)
    });

    setLoading(false);
  };

  const formatCurrency = (value: number) => `$${Math.round(value).toLocaleString()}`;
  const formatPercent = (value: number) => `${value.toFixed(2)}%`;
  const formatVariance = (value: number, isCurrency: boolean = false) => {
    const sign = value >= 0 ? '+' : '';
    return isCurrency ? `${sign}${formatCurrency(value)}` : `${sign}${formatPercent(value)}`;
  };

  const getVarianceColor = (variance: number, isSales = false) => {
    if (isSales) {
      if (variance > 0.1) return 'text-green-600';
      if (variance < -0.1) return 'text-red-600';
    } else {
      if (variance > 0.1) return 'text-red-600';
      if (variance < -0.1) return 'text-green-600';
    }
    return 'text-slate-600';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-center gap-2 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading consolidated metrics...</span>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const SummarySection = ({ title, data, bold }: { title: string; data: any; bold?: boolean }) => (
    <div className={`text-sm ${bold ? 'mb-6' : 'mb-4'}`}>
      <p className={`${bold ? 'font-bold' : 'font-semibold'} text-slate-800 mb-2`}>{title}</p>
      <div className="space-y-1 text-slate-700 ml-4">
        <p>Food Sales — WTD: {formatCurrency(data.wtdSales)} <span className={getVarianceColor(data.wtdSalesVariance / data.wtdSales * 100, true)}>{formatVariance(data.wtdSalesVariance, true)}</span> | PTD: {formatCurrency(data.ptdSales)} <span className={getVarianceColor(data.ptdSalesVariance / data.ptdSales * 100, true)}>{formatVariance(data.ptdSalesVariance, true)}</span> | YTD: {formatCurrency(data.ytdSales)} <span className={getVarianceColor(data.ytdSalesVariance / data.ytdSales * 100, true)}>{formatVariance(data.ytdSalesVariance, true)}</span></p>
        <p>COGS (Food) % — WTD: {formatPercent(data.wtdFoodCostPct)} <span className={getVarianceColor(data.wtdFoodCostVariance)}>{formatVariance(data.wtdFoodCostVariance)}</span> | PTD: {formatPercent(data.ptdFoodCostPct)} <span className={getVarianceColor(data.ptdFoodCostVariance)}>{formatVariance(data.ptdFoodCostVariance)}</span> | YTD: {formatPercent(data.ytdFoodCostPct)} <span className={getVarianceColor(data.ytdFoodCostVariance)}>{formatVariance(data.ytdFoodCostVariance)}</span></p>
        <p>Labour % — WTD: {formatPercent(data.wtdLabourPct)} <span className={getVarianceColor(data.wtdLabourVariance)}>{formatVariance(data.wtdLabourVariance)}</span> | PTD: {formatPercent(data.ptdLabourPct)} <span className={getVarianceColor(data.ptdLabourVariance)}>{formatVariance(data.ptdLabourVariance)}</span> | YTD: {formatPercent(data.ytdLabourPct)} <span className={getVarianceColor(data.ytdLabourVariance)}>{formatVariance(data.ytdLabourVariance)}</span></p>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Budget Variance Summary</h2>
      <SummarySection title="CG Consolidated — All Restaurants" data={metrics.allRestaurants} bold />
      <SummarySection title="Beertown + Sociable" data={metrics.beertownSociable} bold />
      <SummarySection title="Trinity (WC/TBK/Sole)" data={metrics.trinity} />
    </div>
  );
}

function JournalsTable({ fiscalYear, period, week }: { fiscalYear: number; period: number; week: number }) {
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [generatingAll, setGeneratingAll] = useState(false);

  useEffect(() => {
    loadJournals();
  }, [fiscalYear, period, week]);

  const loadJournals = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('weekly_chef_summary')
      .select('id, locations!inner(name, code), notes, hiring_notes, tm_mots_of_note, food_cost_summary, labour_summary, boh_promo_summary, action_plan_summary, ai_summary')
      .eq('fiscal_year', fiscalYear)
      .eq('period_number', period)
      .eq('week_number', week)
      .eq('locations.exclude_from_reporting', false)
      .order('locations(code)');

    if (error) {
      console.error('Error loading journals:', error);
      setLoading(false);
      return;
    }

    const transformedData = (data || []).map((item: any) => ({
      id: item.id,
      location_name: item.locations?.name || 'Unknown',
      notes: item.notes,
      hiring_notes: item.hiring_notes,
      tm_mots_of_note: item.tm_mots_of_note,
      food_cost_summary: item.food_cost_summary,
      labour_summary: item.labour_summary,
      boh_promo_summary: item.boh_promo_summary,
      action_plan_summary: item.action_plan_summary,
      ai_summary: item.ai_summary
    }));

    setJournals(transformedData);
    setLoading(false);
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const generateAllSummaries = async () => {
    setGeneratingAll(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-chef-summary`;

      const summariesData = journals.map(j => ({
        id: j.id,
        location_name: j.location_name,
        food_cost_summary: j.food_cost_summary,
        labour_summary: j.labour_summary,
        boh_promo_summary: j.boh_promo_summary,
        notes: j.notes,
        action_plan_summary: j.action_plan_summary,
        hiring_notes: j.hiring_notes,
        tm_mots_of_note: j.tm_mots_of_note
      }));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ summaries: summariesData })
      });

      if (!response.ok) {
        throw new Error('Failed to generate summaries');
      }

      const { results } = await response.json();

      for (const result of results) {
        await supabase
          .from('weekly_chef_summary')
          .update({ ai_summary: result.ai_summary })
          .eq('id', result.id);
      }

      await loadJournals();
    } catch (error) {
      console.error('Error generating summaries:', error);
      alert('Failed to generate AI summaries. Please try again.');
    } finally {
      setGeneratingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-2" />
        <p className="text-slate-600">Loading journals...</p>
      </div>
    );
  }

  if (journals.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-600">No journals found for this period.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={generateAllSummaries}
          disabled={generatingAll || journals.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          {generatingAll ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating AI Summaries...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate AI Summaries
            </>
          )}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider w-12">
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  AI Summary
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {journals.map((journal) => (
                <>
                  <tr key={journal.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleRow(journal.id)}
                        className="text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        <ChevronRight className={`w-5 h-5 transition-transform ${expandedRows.has(journal.id) ? 'rotate-90' : ''}`} />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {journal.location_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      <div className="max-w-2xl">
                        {journal.ai_summary ? (
                          <p className="leading-relaxed">{journal.ai_summary}</p>
                        ) : (
                          <span className="text-slate-400 italic">No AI summary generated yet</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedRows.has(journal.id) && (
                    <tr className="bg-slate-50">
                      <td colSpan={3} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Food Cost Summary</h4>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                              {journal.food_cost_summary || <span className="text-slate-400">-</span>}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Labour Summary</h4>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                              {journal.labour_summary || <span className="text-slate-400">-</span>}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">BOH Promo Summary</h4>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                              {journal.boh_promo_summary || <span className="text-slate-400">-</span>}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Action Plan Summary</h4>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                              {journal.action_plan_summary || <span className="text-slate-400">-</span>}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Hiring Notes</h4>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                              {journal.hiring_notes || <span className="text-slate-400">-</span>}
                            </p>
                          </div>
                          <div className="md:col-span-2">
                            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Team Member Notes</h4>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                              {journal.tm_mots_of_note || <span className="text-slate-400">-</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReportSection({
  title,
  field,
  value,
  onChange,
  onGenerate,
  generating,
  disabled
}: {
  title: string;
  field: string;
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  generating: boolean;
  disabled: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {!disabled && (
          <button
            onClick={onGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate with AI
              </>
            )}
          </button>
        )}
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={8}
        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-slate-50 disabled:text-slate-600"
        placeholder={`Enter ${title.toLowerCase()} or generate with AI...`}
      />
    </div>
  );
}
