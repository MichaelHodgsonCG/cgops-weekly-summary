import { useState, useEffect, useMemo, useRef } from 'react';
import { Trophy, TrendingUp, TrendingDown, ArrowUp, ArrowDown, ArrowUpDown, MapPin, ChevronDown, BarChart2, Calendar } from 'lucide-react';
import { supabase, Location, PLLineItem } from '../lib/supabase';
import { useLocationFilter } from '../lib/useLocationFilter';

type RankingData = {
  location: Location;
  ptdActual: number | null;
  ptdBudget: number | null;
  ptdVar: number | null;
  ytdActual: number | null;
  ytdBudget: number | null;
  ytdVar: number | null;
};

type RankingsViewProps = {
  weekEndingDate: string;
};

type MetricType = 'foodSales' | 'foodCost' | 'labor' | 'ebitda' | 'other';
type SortColumn = 'name' | 'ptdActual' | 'ptdBudget' | 'ptdVariance' | 'ytdActual' | 'ytdBudget' | 'ytdVariance';
type SortDirection = 'asc' | 'desc';

const OTHER_LINE_ITEMS = [
  'All BOH Costs',
  'Kitchen Supplies',
  'Table and Dishware',
  'IHP Substandard Product',
  'R&M Equipment',
  'Total Sales',
  'EBITDA',
];

const BOH_COST_LINE_ITEMS = [
  'Cost of Sales (Food)',
  'Kitchen Labour',
  'Kitchen Supplies',
  'Table and Dishware',
  'IHP Substandard Product',
  'R&M Equipment',
];

export default function RankingsView({ weekEndingDate }: RankingsViewProps) {
  const [rankings, setRankings] = useState<RankingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('foodSales');
  const [otherLineItem, setOtherLineItem] = useState<string>(OTHER_LINE_ITEMS[0]);
  const [otherDropdownOpen, setOtherDropdownOpen] = useState(false);
  const otherDropdownRef = useRef<HTMLDivElement>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('ptdActual');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const locationFilter = useLocationFilter('rankings');
  const [activeDate, setActiveDate] = useState(weekEndingDate);
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);

  useEffect(() => {
    setActiveDate(weekEndingDate);
  }, [weekEndingDate]);

  useEffect(() => {
    const loadWeeks = async () => {
      const { data } = await supabase
        .from('pl_uploads')
        .select('week_ending_date')
        .order('week_ending_date', { ascending: false });
      if (data) {
        const unique = Array.from(new Set(data.map(d => d.week_ending_date)));
        setAvailableWeeks(unique);
      }
    };
    loadWeeks();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (otherDropdownRef.current && !otherDropdownRef.current.contains(e.target as Node)) {
        setOtherDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadRankings();
  }, [activeDate, selectedMetric, otherLineItem]);

  const loadRankings = async () => {
    setLoading(true);

    const { data: locations, error: locError } = await supabase
      .from('locations')
      .select('*')
      .eq('exclude_from_reporting', false)
      .order('name');

    if (locError || !locations) {
      setLoading(false);
      return;
    }

    const { data: lineItems, error: itemsError } = await supabase
      .from('pl_line_items')
      .select('*')
      .eq('week_ending_date', activeDate);

    if (itemsError) {
      setLoading(false);
      return;
    }

    const rankingData: RankingData[] = locations.map(location => {
      const items = lineItems?.filter(item => item.location_id === location.id) || [];

      let metricItem: PLLineItem | undefined;

      switch (selectedMetric) {
        case 'foodSales':
          metricItem = items.find(i => i.line_item_name === 'Food Sales');
          break;
        case 'foodCost':
          metricItem = items.find(i => i.line_item_name === 'Cost of Sales (Food)');
          break;
        case 'labor':
          metricItem = items.find(i => i.line_item_name === 'Kitchen Labour' || i.line_item_name === 'Labour');
          break;
        case 'ebitda':
          metricItem = items.find(i => i.line_item_name === 'EBITDA');
          break;
        case 'other':
          metricItem = items.find(i => i.line_item_name === otherLineItem);
          break;
      }

      let ptdActual: number | null = null;
      let ptdBudget: number | null = null;
      let ptdVar: number | null = null;
      let ytdActual: number | null = null;
      let ytdBudget: number | null = null;
      let ytdVar: number | null = null;

      const isOtherDollarMetric = selectedMetric === 'other' &&
        (otherLineItem === 'Total Sales' || otherLineItem === 'EBITDA');

      if (selectedMetric === 'other' && otherLineItem === 'All BOH Costs') {
        const foodSales = items.find(i => i.line_item_name === 'Food Sales');
        const foodSalesActual = foodSales?.current_actual ?? 0;
        const foodSalesYtd = foodSales?.ytd_actual ?? 0;
        const bohItems = BOH_COST_LINE_ITEMS.map(name => items.find(i => i.line_item_name === name)).filter(Boolean) as PLLineItem[];
        if (bohItems.length > 0) {
          ptdActual = bohItems.reduce((s, i) => s + (i.current_actual ?? 0), 0);
          ptdBudget = bohItems.reduce((s, i) => s + (i.current_budget ?? 0), 0);
          ytdActual = bohItems.reduce((s, i) => s + (i.ytd_actual ?? 0), 0);
          ytdBudget = bohItems.reduce((s, i) => s + (i.ytd_budget ?? 0), 0);

          if (foodSalesActual > 0) {
            ptdVar = bohItems.reduce((s, i) => {
              const pctDiff = (i.current_actual_pct ?? 0) - (i.current_budget_pct ?? 0);
              return s + (pctDiff / 100) * foodSalesActual;
            }, 0);
          }

          if (foodSalesYtd > 0) {
            ytdVar = bohItems.reduce((s, i) => {
              const pctDiff = (i.ytd_actual_pct ?? 0) - (i.ytd_budget_pct ?? 0);
              return s + (pctDiff / 100) * foodSalesYtd;
            }, 0);
          }
        }
      } else if (metricItem) {
        if (selectedMetric === 'foodCost' || selectedMetric === 'labor' ||
            (selectedMetric === 'other' && !isOtherDollarMetric)) {
          const foodSales = items.find(i => i.line_item_name === 'Food Sales');
          const foodSalesActual = foodSales?.current_actual ?? 0;
          const foodSalesYtd = foodSales?.ytd_actual ?? 0;

          ptdActual = metricItem.current_actual_pct ?? null;
          ptdBudget = metricItem.current_budget_pct ?? null;

          if (metricItem.current_actual_pct !== null && metricItem.current_budget_pct !== null && foodSalesActual > 0) {
            ptdVar = ((metricItem.current_actual_pct - metricItem.current_budget_pct) / 100) * foodSalesActual;
          }

          ytdActual = metricItem.ytd_actual_pct ?? null;
          ytdBudget = metricItem.ytd_budget_pct ?? null;

          if (metricItem.ytd_actual_pct !== null && metricItem.ytd_budget_pct !== null && foodSalesYtd > 0) {
            ytdVar = ((metricItem.ytd_actual_pct - metricItem.ytd_budget_pct) / 100) * foodSalesYtd;
          }
        } else {
          ptdActual = metricItem.current_actual ?? null;
          ptdBudget = metricItem.current_budget ?? null;

          if (metricItem.current_actual !== null && metricItem.current_budget !== null) {
            ptdVar = metricItem.current_actual - metricItem.current_budget;
          }

          ytdActual = metricItem.ytd_actual ?? null;
          ytdBudget = metricItem.ytd_budget ?? null;

          if (metricItem.ytd_actual !== null && metricItem.ytd_budget !== null) {
            ytdVar = metricItem.ytd_actual - metricItem.ytd_budget;
          }
        }
      }

      return {
        location,
        ptdActual,
        ptdBudget,
        ptdVar,
        ytdActual,
        ytdBudget,
        ytdVar
      };
    });

    setRankings(rankingData);
    setLoading(false);
  };

  const [totals, setTotals] = useState<{
    ptdActual: number | null;
    ptdBudget: number | null;
    ptdVar: number | null;
    ytdActual: number | null;
    ytdBudget: number | null;
    ytdVar: number | null;
  } | null>(null);

  useEffect(() => {
    calculateTotals();
  }, [rankings, selectedMetric]);

  const calculateTotals = async () => {
    if (rankings.length === 0) {
      setTotals(null);
      return;
    }

    const isOtherDollarMetric = selectedMetric === 'other' &&
      (otherLineItem === 'Total Sales' || otherLineItem === 'EBITDA');
    const isPercentBased = selectedMetric === 'foodCost' || selectedMetric === 'labor' ||
      (selectedMetric === 'other' && !isOtherDollarMetric);

    if (isPercentBased) {
      let totalPtdCost = 0;
      let totalPtdSales = 0;
      let totalPtdBudgetCost = 0;
      let totalYtdCost = 0;
      let totalYtdSales = 0;
      let totalYtdBudgetCost = 0;

      const { data: lineItems } = await supabase
        .from('pl_line_items')
        .select('*')
        .eq('week_ending_date', activeDate);

      if (!lineItems) {
        setTotals(null);
        return;
      }

      rankings.forEach(({ location }) => {
        const items = lineItems.filter(item => item.location_id === location.id);
        const foodSales = items.find(i => i.line_item_name === 'Food Sales');
        if (!foodSales) return;

        const ptdSales = foodSales.current_actual ?? 0;
        const ytdSales = foodSales.ytd_actual ?? 0;

        totalPtdSales += ptdSales;
        totalYtdSales += ytdSales;

        if (selectedMetric === 'other' && otherLineItem === 'All BOH Costs') {
          const bohItems = BOH_COST_LINE_ITEMS.map(name => items.find(i => i.line_item_name === name)).filter(Boolean) as PLLineItem[];
          bohItems.forEach(i => {
            totalPtdCost += (i.current_actual_pct ?? 0) / 100 * ptdSales;
            totalPtdBudgetCost += (i.current_budget_pct ?? 0) / 100 * ptdSales;
            totalYtdCost += (i.ytd_actual_pct ?? 0) / 100 * ytdSales;
            totalYtdBudgetCost += (i.ytd_budget_pct ?? 0) / 100 * ytdSales;
          });
        } else {
          let metricItem: PLLineItem | undefined;
          if (selectedMetric === 'foodCost') {
            metricItem = items.find(i => i.line_item_name === 'Cost of Sales (Food)');
          } else if (selectedMetric === 'labor') {
            metricItem = items.find(i => i.line_item_name === 'Kitchen Labour' || i.line_item_name === 'Labour');
          } else {
            metricItem = items.find(i => i.line_item_name === otherLineItem);
          }

          if (metricItem) {
            if (metricItem.current_actual_pct !== null) {
              totalPtdCost += (metricItem.current_actual_pct / 100) * ptdSales;
            }
            if (metricItem.current_budget_pct !== null) {
              totalPtdBudgetCost += (metricItem.current_budget_pct / 100) * ptdSales;
            }
            if (metricItem.ytd_actual_pct !== null) {
              totalYtdCost += (metricItem.ytd_actual_pct / 100) * ytdSales;
            }
            if (metricItem.ytd_budget_pct !== null) {
              totalYtdBudgetCost += (metricItem.ytd_budget_pct / 100) * ytdSales;
            }
          }
        }
      });

      const ptdActualPct = totalPtdSales > 0 ? (totalPtdCost / totalPtdSales) * 100 : null;
      const ptdBudgetPct = totalPtdSales > 0 ? (totalPtdBudgetCost / totalPtdSales) * 100 : null;
      const ptdVar = totalPtdCost - totalPtdBudgetCost;

      const ytdActualPct = totalYtdSales > 0 ? (totalYtdCost / totalYtdSales) * 100 : null;
      const ytdBudgetPct = totalYtdSales > 0 ? (totalYtdBudgetCost / totalYtdSales) * 100 : null;
      const ytdVar = totalYtdCost - totalYtdBudgetCost;

      setTotals({
        ptdActual: ptdActualPct,
        ptdBudget: ptdBudgetPct,
        ptdVar,
        ytdActual: ytdActualPct,
        ytdBudget: ytdBudgetPct,
        ytdVar
      });
    } else {
      const ptdActual = rankings.reduce((sum, r) => sum + (r.ptdActual ?? 0), 0);
      const ptdBudget = rankings.reduce((sum, r) => sum + (r.ptdBudget ?? 0), 0);
      const ptdVar = rankings.reduce((sum, r) => sum + (r.ptdVar ?? 0), 0);
      const ytdActual = rankings.reduce((sum, r) => sum + (r.ytdActual ?? 0), 0);
      const ytdBudget = rankings.reduce((sum, r) => sum + (r.ytdBudget ?? 0), 0);
      const ytdVar = rankings.reduce((sum, r) => sum + (r.ytdVar ?? 0), 0);

      setTotals({
        ptdActual,
        ptdBudget,
        ptdVar,
        ytdActual,
        ytdBudget,
        ytdVar
      });
    }
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortedRankings = () => {
    return [...rankings].sort((a, b) => {
      let aValue: number | string | null = null;
      let bValue: number | string | null = null;

      switch (sortColumn) {
        case 'name':
          aValue = a.location.name.toLowerCase();
          bValue = b.location.name.toLowerCase();
          break;
        case 'ptdActual':
          aValue = a.ptdActual;
          bValue = b.ptdActual;
          break;
        case 'ptdBudget':
          aValue = a.ptdBudget;
          bValue = b.ptdBudget;
          break;
        case 'ptdVariance':
          aValue = a.ptdVar;
          bValue = b.ptdVar;
          break;
        case 'ytdActual':
          aValue = a.ytdActual;
          bValue = b.ytdActual;
          break;
        case 'ytdBudget':
          aValue = a.ytdBudget;
          bValue = b.ytdBudget;
          break;
        case 'ytdVariance':
          aValue = a.ytdVar;
          bValue = b.ytdVar;
          break;
      }

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const result = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? result : -result;
      }

      const result = (aValue as number) - (bValue as number);
      return sortDirection === 'asc' ? result : -result;
    });
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return '-';
    return `${value.toFixed(2)}%`;
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-slate-700" />
      : <ArrowDown className="w-3 h-3 text-slate-700" />;
  };

  const isOtherDollarMetric = selectedMetric === 'other' &&
    (otherLineItem === 'Total Sales' || otherLineItem === 'EBITDA' || otherLineItem === 'All BOH Costs');
  const isPercentageMetric = selectedMetric === 'foodCost' || selectedMetric === 'labor' ||
    (selectedMetric === 'other' && !isOtherDollarMetric);

  const isCostMetric = selectedMetric === 'foodCost' || selectedMetric === 'labor' ||
    (selectedMetric === 'other' && otherLineItem !== 'Total Sales' && otherLineItem !== 'EBITDA');

  const formatValue = (value: number | null, isPercentage: boolean = false) => {
    if (value === null) return '-';
    return isPercentage ? formatPercent(value) : formatCurrency(value);
  };

  const metrics = [
    { id: 'foodSales' as MetricType, label: 'Food Sales', icon: TrendingUp },
    { id: 'foodCost' as MetricType, label: 'Food Cost %', icon: TrendingDown },
    { id: 'labor' as MetricType, label: 'Labour %', icon: TrendingDown },
    { id: 'ebitda' as MetricType, label: 'EBITDA vs Budget', icon: Trophy },
    { id: 'other' as MetricType, label: 'Other', icon: BarChart2 }
  ];

  const allSortedRankings = getSortedRankings();
  const sortedRankings = useMemo(() => {
    if (!locationFilter.isFiltered || !locationFilter.hasPreferences) return allSortedRankings;
    return allSortedRankings.filter(r => locationFilter.preferredLocations.includes(r.location.name));
  }, [allSortedRankings, locationFilter.isFiltered, locationFilter.hasPreferences, locationFilter.preferredLocations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading rankings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3 sm:hidden">
          <span className="text-sm font-medium text-slate-700">Ranking Metric</span>
          <div className="flex items-center gap-2">
            {availableWeeks.length > 0 && (
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <select
                  value={activeDate}
                  onChange={(e) => setActiveDate(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  {availableWeeks.map(w => (
                    <option key={w} value={w}>{new Date(w).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</option>
                  ))}
                </select>
              </div>
            )}
            {locationFilter.hasPreferences && (
              <button
                onClick={() => locationFilter.setIsFiltered(!locationFilter.isFiltered)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  locationFilter.isFiltered
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                {locationFilter.isFiltered ? 'My Locations' : 'All'}
              </button>
            )}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex flex-1 gap-2">
          {metrics.map(metric => {
            const Icon = metric.icon;
            if (metric.id === 'other') {
              return (
                <div key="other" className="flex-1 relative" ref={otherDropdownRef}>
                  <button
                    onClick={() => {
                      if (selectedMetric !== 'other') {
                        setSelectedMetric('other');
                        setOtherDropdownOpen(true);
                      } else {
                        setOtherDropdownOpen(prev => !prev);
                      }
                    }}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      selectedMetric === 'other'
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {selectedMetric === 'other' ? otherLineItem : 'Other'}
                    <ChevronDown className="w-3.5 h-3.5 ml-auto opacity-70" />
                  </button>
                  {otherDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                      {OTHER_LINE_ITEMS.map(item => (
                        <button
                          key={item}
                          onClick={() => {
                            setOtherLineItem(item);
                            setOtherDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-slate-50 ${
                            otherLineItem === item ? 'font-semibold text-slate-900 bg-slate-50' : 'text-slate-700'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button
                key={metric.id}
                onClick={() => setSelectedMetric(metric.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  selectedMetric === metric.id
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {metric.label}
              </button>
            );
          })}
          </div>
          {availableWeeks.length > 0 && (
            <div className="relative flex-shrink-0">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={activeDate}
                onChange={(e) => setActiveDate(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-slate-500 focus:border-transparent appearance-none cursor-pointer"
              >
                {availableWeeks.map(w => (
                  <option key={w} value={w}>Week ending {new Date(w).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</option>
                ))}
              </select>
            </div>
          )}
          {locationFilter.hasPreferences && (
            <button
              onClick={() => locationFilter.setIsFiltered(!locationFilter.isFiltered)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border flex-shrink-0 ${
                locationFilter.isFiltered
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              {locationFilter.isFiltered ? 'My Locations' : 'All Locations'}
            </button>
          )}
        </div>

        <div className="sm:hidden">
          <label className="block text-sm font-medium text-slate-700 mb-2">Ranking Metric</label>
          <select
            value={selectedMetric === 'other' ? `other:${otherLineItem}` : selectedMetric}
            onChange={(e) => {
              const val = e.target.value;
              if (val.startsWith('other:')) {
                setSelectedMetric('other');
                setOtherLineItem(val.replace('other:', ''));
              } else {
                setSelectedMetric(val as MetricType);
              }
            }}
            className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-slate-800"
          >
            {metrics.filter(m => m.id !== 'other').map(metric => (
              <option key={metric.id} value={metric.id}>{metric.label}</option>
            ))}
            <optgroup label="Other">
              {OTHER_LINE_ITEMS.map(item => (
                <option key={item} value={`other:${item}`}>{item}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden max-w-full">
        <div className="overflow-x-auto -mx-0">
          <table className="w-full min-w-max">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-12 sm:w-16">Rank</th>
                <th className="px-2 sm:px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider hover:text-slate-900 transition-colors"
                  >
                    Location
                    <SortIcon column="name" />
                  </button>
                </th>
                <th className="px-2 sm:px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('ptdActual')}
                    className="ml-auto flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider hover:text-slate-900 transition-colors whitespace-nowrap"
                  >
                    PTD Act
                    <SortIcon column="ptdActual" />
                  </button>
                </th>
                <th className="px-2 sm:px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('ptdBudget')}
                    className="ml-auto flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider hover:text-slate-900 transition-colors whitespace-nowrap"
                  >
                    PTD Bgt
                    <SortIcon column="ptdBudget" />
                  </button>
                </th>
                <th className="px-2 sm:px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('ptdVariance')}
                    className="ml-auto flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider hover:text-slate-900 transition-colors whitespace-nowrap"
                  >
                    PTD Var
                    <SortIcon column="ptdVariance" />
                  </button>
                </th>
                <th className="px-2 sm:px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('ytdActual')}
                    className="ml-auto flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider hover:text-slate-900 transition-colors whitespace-nowrap"
                  >
                    YTD Act
                    <SortIcon column="ytdActual" />
                  </button>
                </th>
                <th className="px-2 sm:px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('ytdBudget')}
                    className="ml-auto flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider hover:text-slate-900 transition-colors whitespace-nowrap"
                  >
                    YTD Bgt
                    <SortIcon column="ytdBudget" />
                  </button>
                </th>
                <th className="px-2 sm:px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('ytdVariance')}
                    className="ml-auto flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider hover:text-slate-900 transition-colors whitespace-nowrap"
                  >
                    YTD Var
                    <SortIcon column="ytdVariance" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {totals && (
                <tr className="bg-slate-100 font-semibold border-b-2 border-slate-300">
                  <td className="px-2 sm:px-4 py-3">
                    <div className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-bold bg-slate-700 text-white">
                      ∑
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-3">
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">TOTAL</div>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-right">
                    <span className="text-xs sm:text-sm font-bold text-slate-900">{formatValue(totals.ptdActual, isPercentageMetric)}</span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-right">
                    <span className="text-xs sm:text-sm font-semibold text-slate-700">{formatValue(totals.ptdBudget, isPercentageMetric)}</span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-right">
                    <span className={`text-xs sm:text-sm font-bold ${
                      totals.ptdVar === null ? '' :
                      isCostMetric
                        ? (totals.ptdVar <= 0 ? 'text-green-600' : 'text-red-600')
                        : (totals.ptdVar >= 0 ? 'text-green-600' : 'text-red-600')
                    }`}>
                      {formatCurrency(totals.ptdVar)}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-right">
                    <span className="text-xs sm:text-sm font-bold text-slate-900">{formatValue(totals.ytdActual, isPercentageMetric)}</span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-right">
                    <span className="text-xs sm:text-sm font-semibold text-slate-700">{formatValue(totals.ytdBudget, isPercentageMetric)}</span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-right">
                    <span className={`text-xs sm:text-sm font-bold ${
                      totals.ytdVar === null ? '' :
                      isCostMetric
                        ? (totals.ytdVar <= 0 ? 'text-green-600' : 'text-red-600')
                        : (totals.ytdVar >= 0 ? 'text-green-600' : 'text-red-600')
                    }`}>
                      {formatCurrency(totals.ytdVar)}
                    </span>
                  </td>
                </tr>
              )}
              {sortedRankings.map((data, index) => {
                const rank = index + 1;
                return (
                  <tr key={data.location.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-2 sm:px-4 py-3">
                      <div className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-semibold bg-slate-100 text-slate-700">
                        {rank}
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-3">
                      <div className="font-medium text-slate-800 text-xs sm:text-sm">{data.location.name}</div>
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-right">
                      <span className="text-xs sm:text-sm font-semibold text-slate-800">{formatValue(data.ptdActual, isPercentageMetric)}</span>
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-right">
                      <span className="text-xs sm:text-sm text-slate-600">{formatValue(data.ptdBudget, isPercentageMetric)}</span>
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-right">
                      <span className={`text-xs sm:text-sm font-semibold ${
                        data.ptdVar === null ? '' :
                        isCostMetric
                          ? (data.ptdVar <= 0 ? 'text-green-600' : 'text-red-600')
                          : (data.ptdVar >= 0 ? 'text-green-600' : 'text-red-600')
                      }`}>
                        {formatCurrency(data.ptdVar)}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-right">
                      <span className="text-xs sm:text-sm font-semibold text-slate-800">{formatValue(data.ytdActual, isPercentageMetric)}</span>
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-right">
                      <span className="text-xs sm:text-sm text-slate-600">{formatValue(data.ytdBudget, isPercentageMetric)}</span>
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-right">
                      <span className={`text-xs sm:text-sm font-semibold ${
                        data.ytdVar === null ? '' :
                        isCostMetric
                          ? (data.ytdVar <= 0 ? 'text-green-600' : 'text-red-600')
                          : (data.ytdVar >= 0 ? 'text-green-600' : 'text-red-600')
                      }`}>
                        {formatCurrency(data.ytdVar)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {sortedRankings.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <p className="text-slate-600">No ranking data available for this week</p>
        </div>
      )}
    </div>
  );
}
