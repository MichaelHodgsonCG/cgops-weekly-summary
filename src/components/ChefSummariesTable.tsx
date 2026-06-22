import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ChefSummary {
  id: string;
  location_id: string;
  location_name: string;
  week_number: number;
  period_number: number;
  fiscal_year: number;
  budget_food_cost_pct: number | null;
  actual_food_cost_pct: number | null;
  fc_variance: number | null;
  theoretical_food_cost_pct: number | null;
  on_hand_amount: number | null;
  theoretical_variance: number | null;
  sage_food_sales_qtd: number | null;
  sage_fcost_qtd_pct: number | null;
  food_cost_ptd_pct: number | null;
  sage_sales_budget_qtd: number | null;
  fc_qtd_pct: number | null;
  qtd_variance_pct: number | null;
  usage_amount: number | null;
  ideal_usage_amount: number | null;
  cogs_qtd: number | null;
  food_sales_labour_push: number | null;
  food_sales_oc: number | null;
  week_variance_amount: number | null;
  budget_food_sales_period: number | null;
  week_budget: number | null;
  qtd_variance_amount: number | null;
  labour_budget_pct: number | null;
  labour_cost_pct: number | null;
  lc_variance: number | null;
  sage_labour_budget_qtd_pct: number | null;
  sage_lcost_qtd_pct: number | null;
  labour_cost_ptd_pct: number | null;
  labour_qtd_pct: number | null;
  lab_ptd_var_amount: number | null;
  qtd_labour_variance_pct: number | null;
  labour_spent: number | null;
  overtime_amount: number | null;
  lab_qtd_var_amount: number | null;
  ebidta_budget_period_pct: number | null;
  ebidta_ptd_pct: number | null;
  ebidta_variance_pct: number | null;
  teamshare_amount: number | null;
  petty_cash: number | null;
  waste_amount: number | null;
  last_audit_score_pct: number | null;
  boh_promo_amount: number | null;
  promo_ptd: number | null;
  promo_qtd: number | null;
  weeks_remaining_in_qtr: number | null;
  sous_vac_days: number | null;
  ideal_cooks: number | null;
  current_cooks: number | null;
  ideal_prep: number | null;
  current_prep: number | null;
  ideal_dish: number | null;
  current_dish: number | null;
  ideal_other: number | null;
  current_other: number | null;
}

interface ChefSummariesTableProps {
  fiscalYear: number;
  period: number;
  week: number;
}

export function ChefSummariesTable({ fiscalYear, period, week }: ChefSummariesTableProps) {
  const [summaries, setSummaries] = useState<ChefSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState<keyof ChefSummary | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadSummaries();
  }, [fiscalYear, period, week]);

  const loadSummaries = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('weekly_chef_summary')
      .select('*, locations!inner(name, code)')
      .eq('fiscal_year', fiscalYear)
      .eq('period_number', period)
      .eq('week_number', week)
      .eq('locations.exclude_from_reporting', false)
      .order('locations(code)');

    if (error) {
      console.error('Error loading chef summaries:', error);
      setLoading(false);
      return;
    }

    const transformedData = (data || []).map((item: any) => ({
      ...item,
      food_sales_labour_push: item.food_sales_labour_push ?? item.food_sales_silverware ?? 0,
      location_name: item.locations?.name || 'Unknown'
    }));

    setSummaries(transformedData);
    setLoading(false);
  };

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return `${value.toFixed(2)}%`;
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const handleSort = (column: keyof ChefSummary) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedSummaries = [...summaries].sort((a, b) => {
    if (!sortColumn) return 0;

    const aVal = a[sortColumn];
    const bVal = b[sortColumn];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'desc'
        ? bVal.localeCompare(aVal)
        : aVal.localeCompare(bVal);
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    }

    return 0;
  });

  const SortIcon = ({ column }: { column: keyof ChefSummary }) => {
    if (sortColumn !== column) {
      return <ChevronDown className="w-4 h-4 text-slate-300" />;
    }
    return sortDirection === 'desc'
      ? <ChevronDown className="w-4 h-4 text-slate-600" />
      : <ChevronUp className="w-4 h-4 text-slate-600" />;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-slate-600">Loading summaries...</div>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-slate-600">No summaries found for this period</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700 border-r border-slate-200">
                <button onClick={() => handleSort('location_name')} className="flex items-center gap-1 hover:text-slate-900">
                  Location <SortIcon column="location_name" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('budget_food_cost_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Budget FC % <SortIcon column="budget_food_cost_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('actual_food_cost_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Actual FC % <SortIcon column="actual_food_cost_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('fc_variance')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  FC Variance <SortIcon column="fc_variance" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('theoretical_food_cost_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Theoretical FC % <SortIcon column="theoretical_food_cost_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('on_hand_amount')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  On Hand <SortIcon column="on_hand_amount" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('theoretical_variance')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Theoretical Var <SortIcon column="theoretical_variance" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('sage_food_sales_qtd')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Sage Food Sales QTD <SortIcon column="sage_food_sales_qtd" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('sage_fcost_qtd_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Sage FC QTD % <SortIcon column="sage_fcost_qtd_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('food_cost_ptd_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  FC PTD % <SortIcon column="food_cost_ptd_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('sage_sales_budget_qtd')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Sage Sales Budget QTD <SortIcon column="sage_sales_budget_qtd" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('fc_qtd_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  FC QTD % <SortIcon column="fc_qtd_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('qtd_variance_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  QTD Variance % <SortIcon column="qtd_variance_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('usage_amount')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Usage Amount <SortIcon column="usage_amount" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('ideal_usage_amount')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Ideal Usage <SortIcon column="ideal_usage_amount" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('cogs_qtd')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  COGS QTD <SortIcon column="cogs_qtd" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('food_sales_labour_push')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Food Sales Labour Push <SortIcon column="food_sales_labour_push" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('food_sales_oc')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Food Sales OC <SortIcon column="food_sales_oc" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('week_variance_amount')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Week Variance <SortIcon column="week_variance_amount" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('budget_food_sales_period')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Budget Food Sales Period <SortIcon column="budget_food_sales_period" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('week_budget')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Week Budget <SortIcon column="week_budget" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('qtd_variance_amount')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  QTD Variance Amount <SortIcon column="qtd_variance_amount" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('labour_budget_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Labour Budget % <SortIcon column="labour_budget_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('labour_cost_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Labour Cost % <SortIcon column="labour_cost_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('lc_variance')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  LC Variance <SortIcon column="lc_variance" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('sage_labour_budget_qtd_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Sage Labour Budget QTD % <SortIcon column="sage_labour_budget_qtd_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('sage_lcost_qtd_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Sage LC QTD % <SortIcon column="sage_lcost_qtd_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('labour_cost_ptd_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Labour Cost PTD % <SortIcon column="labour_cost_ptd_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('labour_qtd_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Labour QTD % <SortIcon column="labour_qtd_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('lab_ptd_var_amount')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Lab PTD Var <SortIcon column="lab_ptd_var_amount" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('qtd_labour_variance_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  QTD Labour Variance % <SortIcon column="qtd_labour_variance_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('labour_spent')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Labour Spent <SortIcon column="labour_spent" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('overtime_amount')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Overtime <SortIcon column="overtime_amount" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('lab_qtd_var_amount')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Lab QTD Var <SortIcon column="lab_qtd_var_amount" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('ebidta_variance_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  EBITDA Variance % <SortIcon column="ebidta_variance_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('teamshare_amount')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Teamshare <SortIcon column="teamshare_amount" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('petty_cash')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Petty Cash <SortIcon column="petty_cash" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('waste_amount')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Waste <SortIcon column="waste_amount" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('last_audit_score_pct')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Last Audit Score % <SortIcon column="last_audit_score_pct" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('boh_promo_amount')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  BOH Promo <SortIcon column="boh_promo_amount" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('promo_ptd')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Promo PTD <SortIcon column="promo_ptd" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('promo_qtd')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Promo QTD <SortIcon column="promo_qtd" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('sous_vac_days')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Sous Vac Days <SortIcon column="sous_vac_days" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('ideal_cooks')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Ideal Cooks <SortIcon column="ideal_cooks" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('current_cooks')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Current Cooks <SortIcon column="current_cooks" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('ideal_prep')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Ideal Prep <SortIcon column="ideal_prep" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('current_prep')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Current Prep <SortIcon column="current_prep" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('ideal_dish')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Ideal Dish <SortIcon column="ideal_dish" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('current_dish')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Current Dish <SortIcon column="current_dish" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('ideal_other')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Ideal Other <SortIcon column="ideal_other" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                <button onClick={() => handleSort('current_other')} className="flex items-center gap-1 ml-auto hover:text-slate-900">
                  Current Other <SortIcon column="current_other" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sortedSummaries.map((summary) => (
              <tr key={summary.id} className="hover:bg-slate-50">
                <td className="sticky left-0 z-10 bg-white hover:bg-slate-50 px-4 py-3 font-medium text-slate-800 border-r border-slate-200">{summary.location_name}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.budget_food_cost_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.actual_food_cost_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.fc_variance)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.theoretical_food_cost_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.on_hand_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.theoretical_variance)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.sage_food_sales_qtd)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.sage_fcost_qtd_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.food_cost_ptd_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.sage_sales_budget_qtd)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.fc_qtd_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.qtd_variance_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.usage_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.ideal_usage_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.cogs_qtd)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.food_sales_labour_push)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.food_sales_oc)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.week_variance_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.budget_food_sales_period)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.week_budget)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.qtd_variance_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.labour_budget_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.labour_cost_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.lc_variance)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.sage_labour_budget_qtd_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.sage_lcost_qtd_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.labour_cost_ptd_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.labour_qtd_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.lab_ptd_var_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.qtd_labour_variance_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.labour_spent)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.overtime_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.lab_qtd_var_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.ebidta_variance_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.teamshare_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.petty_cash)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.waste_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatPercent(summary.last_audit_score_pct)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.boh_promo_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.promo_ptd)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(summary.promo_qtd)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatNumber(summary.sous_vac_days)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatNumber(summary.ideal_cooks)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatNumber(summary.current_cooks)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatNumber(summary.ideal_prep)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatNumber(summary.current_prep)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatNumber(summary.ideal_dish)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatNumber(summary.current_dish)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatNumber(summary.ideal_other)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatNumber(summary.current_other)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
