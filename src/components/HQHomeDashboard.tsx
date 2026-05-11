import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useLocationFilter } from '../lib/useLocationFilter';
import {
  TrendingUp, TrendingDown, AlertTriangle, AlertCircle, Sparkles,
  Star, ChevronRight, ArrowUpRight, ArrowDownRight, Activity,
  MessageSquare, FileText, Briefcase, CheckCircle, Filter
} from 'lucide-react';

interface SLPSalesRow {
  location_name: string;
  total_wtd_sales: number | null;
  wtd_sales_vs_last_year_pct: number | null;
}

interface SLPAlert {
  id: string;
  locationName: string;
  department: string;
  alertType: 'projected_above_budget' | 'labour_caution';
  budgetPct: number | null;
  projectedPct: number | null;
  wtdDollarsVsSales: number | null;
  wtdDollarsVsProj: number | null;
  variance: number;
  projectedVariancePct: number | null;
}

interface DailyInsight {
  id: string;
  analysis_date: string;
  concerns_json: Array<{ location: string; issue: string; severity: string }>;
  highlights_json: Array<{ location: string; note: string }>;
  ai_summary_json: { summary: string } | null;
  concerns_count: number;
  highlights_count: number;
}

interface LowCategoryScore {
  category: string;
  minScore: number;
}

interface LowReviewLocation {
  location_name: string;
  low_categories: LowCategoryScore[];
  latest_review_date: string;
  avg_rating: number;
}

interface WTDSummary {
  totalWtdSales: number;
  locationCount: number;
  avgYoyPct: number | null;
  reportDate: string | null;
  topIncreases: SLPSalesRow[];
  projectedAboveBudget: SLPAlert[];
  labourCaution: SLPAlert[];
}

type Props = {
  onNavigate: (view: 'slp' | 'logs' | 'feedback') => void;
};

export default function HQHomeDashboard({ onNavigate }: Props) {
  const { user } = useAuth();
  const locationFilter = useLocationFilter('hq');
  const [wtd, setWtd] = useState<WTDSummary | null>(null);
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [lowReviewLocations, setLowReviewLocations] = useState<LowReviewLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, [user, locationFilter.isFiltered, locationFilter.preferredLocations]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadWTD(), loadInsight(), loadReviews()]);
    setLoading(false);
  };

  const loadWTD = async () => {
    const { data: report } = await supabase
      .from('slp_reports')
      .select('id, report_date')
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!report) return;

    const [{ data: salesRows }, { data: labourRows }] = await Promise.all([
      supabase
        .from('slp_sales_data')
        .select('location_name, total_wtd_sales, wtd_sales_vs_last_year_pct')
        .eq('report_id', report.id),
      supabase
        .from('slp_labor_data')
        .select('*')
        .eq('report_id', report.id),
    ]);

    const allSales: SLPSalesRow[] = salesRows ?? [];
    const allLabour = labourRows ?? [];

    const sales = locationFilter.isFiltered && locationFilter.hasPreferences
      ? allSales.filter(r => locationFilter.preferredLocations.includes(r.location_name))
      : allSales;
    const labour = locationFilter.isFiltered && locationFilter.hasPreferences
      ? allLabour.filter((r: Record<string, unknown>) => locationFilter.preferredLocations.includes(r.location_name as string))
      : allLabour;

    const totalWtdSales = sales.reduce((sum, r) => sum + (r.total_wtd_sales ?? 0), 0);
    const yoyRows = sales.filter(r => r.wtd_sales_vs_last_year_pct !== null);
    const avgYoyPct = yoyRows.length > 0
      ? yoyRows.reduce((sum, r) => sum + (r.wtd_sales_vs_last_year_pct ?? 0), 0) / yoyRows.length
      : null;

    const topIncreases = [...sales]
      .filter(r => r.wtd_sales_vs_last_year_pct !== null)
      .sort((a, b) => (b.wtd_sales_vs_last_year_pct ?? 0) - (a.wtd_sales_vs_last_year_pct ?? 0))
      .slice(0, 3);

    const projectedAboveBudget: SLPAlert[] = [];
    const labourCaution: SLPAlert[] = [];

    labour.forEach((labor: Record<string, unknown>) => {
      if (labor.department === 'Manager') return;

      const budgetPct = labor.labour_budget_pct as number | null;
      const fullWeekProj = labor.full_week_labour_projection_pct as number | null;
      const wtdVsSales = labor.wtd_labour_dollars_vs_sales as number | null;
      const wtdVsProj = labor.wtd_labour_dollars_vs_projections as number | null;
      const locationName = labor.location_name as string;
      const department = labor.department as string;

      if (budgetPct !== null && fullWeekProj !== null && fullWeekProj > budgetPct) {
        projectedAboveBudget.push({
          id: `${locationName}-${department}-projected`,
          locationName,
          department,
          alertType: 'projected_above_budget',
          budgetPct,
          projectedPct: fullWeekProj,
          wtdDollarsVsSales: null,
          wtdDollarsVsProj: null,
          variance: fullWeekProj - budgetPct,
          projectedVariancePct: null,
        });
      }

      if (wtdVsSales !== null && wtdVsProj !== null && wtdVsSales > 0 && wtdVsProj > 0) {
        labourCaution.push({
          id: `${locationName}-${department}-caution`,
          locationName,
          department,
          alertType: 'labour_caution',
          budgetPct,
          projectedPct: fullWeekProj,
          wtdDollarsVsSales: wtdVsSales,
          wtdDollarsVsProj: wtdVsProj,
          variance: wtdVsSales,
          projectedVariancePct: (budgetPct !== null && fullWeekProj !== null)
            ? fullWeekProj - budgetPct
            : null,
        });
      }
    });

    projectedAboveBudget.sort((a, b) => b.variance - a.variance);
    labourCaution.sort((a, b) => b.variance - a.variance);

    setWtd({
      totalWtdSales,
      locationCount: sales.length,
      avgYoyPct,
      reportDate: report.report_date,
      topIncreases,
      projectedAboveBudget,
      labourCaution,
    });
  };

  const loadInsight = async () => {
    const { data } = await supabase
      .from('daily_insights')
      .select('id, analysis_date, concerns_json, highlights_json, ai_summary_json, concerns_count, highlights_count')
      .order('analysis_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const insight = data as DailyInsight;
      if (locationFilter.isFiltered && locationFilter.hasPreferences) {
        insight.concerns_json = (insight.concerns_json ?? []).filter(c =>
          locationFilter.preferredLocations.some(loc => c.location.includes(loc) || loc.includes(c.location))
        );
        insight.highlights_json = (insight.highlights_json ?? []).filter(h =>
          locationFilter.preferredLocations.some(loc => h.location.includes(loc) || loc.includes(h.location))
        );
        insight.concerns_count = insight.concerns_json.length;
        insight.highlights_count = insight.highlights_json.length;
      }
      setInsight(insight);
    }
  };

  const loadReviews = async () => {
    const [{ data: excluded }, dismissedResult] = await Promise.all([
      supabase.from('locations').select('name').eq('exclude_from_reporting', true),
      user
        ? supabase.from('dismissed_alerts').select('location_name, latest_review_date').eq('user_id', user.id)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const excludedNames = (excluded ?? []).map((l: { name: string }) => l.name);

    const dismissedMap = new Map<string, string | null>();
    (dismissedResult.data ?? []).forEach((r: { location_name: string; latest_review_date: string | null }) => {
      dismissedMap.set(r.location_name, r.latest_review_date);
    });

    let query = supabase
      .from('guest_feedback')
      .select('location_name, overall_rating, food_rating, service_rating, ambience_rating, value_rating, review_date')
      .order('review_date', { ascending: false });

    if (excludedNames.length > 0) {
      query = query.not('location_name', 'in', `(${excludedNames.join(',')})`);
    }

    const { data: feedbacks } = await query;
    if (!feedbacks) return;

    type FeedbackRow = {
      location_name: string;
      overall_rating: number | null;
      food_rating: number | null;
      service_rating: number | null;
      ambience_rating: number | null;
      value_rating: number | null;
      review_date: string;
    };

    const statsMap = new Map<string, {
      lowCats: Map<string, number>;
      latestDate: string;
      totalRating: number;
      ratingCount: number;
    }>();

    (feedbacks as FeedbackRow[]).forEach(r => {
      if (!statsMap.has(r.location_name)) {
        statsMap.set(r.location_name, {
          lowCats: new Map(),
          latestDate: r.review_date,
          totalRating: 0,
          ratingCount: 0,
        });
      }
      const s = statsMap.get(r.location_name)!;
      const checkCat = (cat: string, val: number | null) => {
        if (val !== null && val < 4) {
          const existing = s.lowCats.get(cat);
          if (existing === undefined || val < existing) s.lowCats.set(cat, val);
        }
      };
      checkCat('Overall', r.overall_rating);
      checkCat('Food', r.food_rating);
      checkCat('Service', r.service_rating);
      checkCat('Ambience', r.ambience_rating);
      checkCat('Value', r.value_rating);
      if (r.review_date > s.latestDate) s.latestDate = r.review_date;
      if (r.overall_rating !== null) {
        s.totalRating += r.overall_rating;
        s.ratingCount++;
      }
    });

    const lows: LowReviewLocation[] = [];
    statsMap.forEach((val, loc) => {
      if (val.lowCats.size === 0) return;

      const dismissedDate = dismissedMap.get(loc);
      if (dismissedDate && dismissedDate === val.latestDate) return;

      const low_categories: LowCategoryScore[] = Array.from(val.lowCats.entries()).map(([cat, score]) => ({
        category: cat,
        minScore: score,
      }));
      lows.push({
        location_name: loc,
        low_categories,
        latest_review_date: val.latestDate,
        avg_rating: val.ratingCount > 0 ? val.totalRating / val.ratingCount : 0,
      });
    });

    lows.sort((a, b) => a.avg_rating - b.avg_rating);

    const filteredLows = locationFilter.isFiltered && locationFilter.hasPreferences
      ? lows.filter(l => locationFilter.preferredLocations.includes(l.location_name))
      : lows;

    setLowReviewLocations(filteredLows.slice(0, 6));
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatPct = (n: number | null, forceSign = false) => {
    if (n === null) return '—';
    const sign = forceSign && n > 0 ? '+' : '';
    return `${sign}${n.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-slate-500">
          <Activity className="w-5 h-5 animate-pulse" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  const totalSlpAlerts = (wtd?.projectedAboveBudget.length ?? 0) + (wtd?.labourCaution.length ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl shadow-sm p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">HQ Overview</h1>
            <p className="mt-1 text-slate-300 text-sm">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {locationFilter.hasPreferences && (
              <button
                onClick={() => locationFilter.setIsFiltered(!locationFilter.isFiltered)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  locationFilter.isFiltered
                    ? 'bg-white text-slate-800 hover:bg-slate-100'
                    : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                {locationFilter.isFiltered ? 'My Locations' : 'All Locations'}
              </button>
            )}
            <Activity className="w-10 h-10 text-slate-400" />
          </div>
        </div>
      </div>

      {/* WTD Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-800">Week-to-Date Performance</h2>
          </div>
          <button
            onClick={() => onNavigate('slp')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            View SLP <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {!wtd ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No SLP data available</p>
          </div>
        ) : (
          <div
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer hover:border-slate-400 transition-colors"
            onClick={() => onNavigate('slp')}
          >
            {/* Summary bar */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
              <div className="px-5 py-4">
                <div className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">WTD Sales</div>
                <div className="text-xl font-bold text-slate-800">{formatCurrency(wtd.totalWtdSales)}</div>
                <div className="text-xs text-slate-400 mt-0.5">{wtd.locationCount} locations</div>
              </div>
              <div className="px-5 py-4">
                <div className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">Avg vs Last Year</div>
                <div className={`text-xl font-bold flex items-center gap-1 ${
                  wtd.avgYoyPct === null ? 'text-slate-400'
                  : wtd.avgYoyPct >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {wtd.avgYoyPct !== null && (
                    wtd.avgYoyPct >= 0
                      ? <ArrowUpRight className="w-5 h-5" />
                      : <ArrowDownRight className="w-5 h-5" />
                  )}
                  {formatPct(wtd.avgYoyPct, true)}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">portfolio average</div>
              </div>
              <div className="px-5 py-4">
                <div className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">Labour Alerts</div>
                <div className={`text-xl font-bold ${totalSlpAlerts > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {totalSlpAlerts}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">critical concerns</div>
              </div>
            </div>

            {/* Top 3 Sales Increases */}
            {wtd.topIncreases.length > 0 && (
              <div>
                <div className="px-5 pt-3 pb-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Top 3 Sales Increases vs Last Year</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {wtd.topIncreases.map((loc, i) => {
                    const pct = loc.wtd_sales_vs_last_year_pct;
                    return (
                      <div key={loc.location_name} className="flex items-center justify-between px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                          <span className="text-sm text-slate-700 font-medium">{loc.location_name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-semibold text-slate-800">
                            {loc.total_wtd_sales !== null ? formatCurrency(loc.total_wtd_sales) : '—'}
                          </span>
                          <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 w-16 justify-end">
                            <TrendingUp className="w-3 h-3" />
                            {formatPct(pct, true)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SLP Critical Concerns */}
            {totalSlpAlerts > 0 && (
              <div className="border-t border-slate-100">
                <div className="px-5 pt-3 pb-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">SLP Critical Concerns</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {wtd.projectedAboveBudget.slice(0, 4).map(alert => (
                    <div key={alert.id} className="flex items-center justify-between px-5 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-slate-800">{alert.locationName}</span>
                          <span className="text-xs text-slate-500 ml-1.5">{alert.department}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2 text-right">
                        <span className="text-xs text-slate-500">{formatPct(alert.budgetPct)} budget</span>
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          Proj {formatPct(alert.projectedPct)} (+{alert.variance.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  ))}
                  {wtd.labourCaution.slice(0, 4).map(alert => (
                    <div key={alert.id} className="flex items-center justify-between px-5 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-slate-800">{alert.locationName}</span>
                          <span className="text-xs text-slate-500 ml-1.5">{alert.department}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-xs font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                          WTD $ vs Sales: {alert.wtdDollarsVsSales !== null
                            ? new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(alert.wtdDollarsVsSales)
                            : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {(wtd.projectedAboveBudget.length > 4 || wtd.labourCaution.length > 4) && (
                  <div className="px-5 py-2 text-xs text-slate-400">
                    +{Math.max(0, wtd.projectedAboveBudget.length - 4) + Math.max(0, wtd.labourCaution.length - 4)} more — view SLP for full list
                  </div>
                )}
              </div>
            )}

            {totalSlpAlerts === 0 && wtd.topIncreases.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-emerald-700 font-medium">No SLP labour concerns</span>
              </div>
            )}

            <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {wtd.reportDate ? `Report: ${formatDate(wtd.reportDate)}` : ''}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                View full SLP <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Daily Insights Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-800">Daily Journal Insights</h2>
          </div>
          <button
            onClick={() => onNavigate('logs')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            View Logs <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {!insight ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No daily insights available yet</p>
          </div>
        ) : (
          <div
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer hover:border-slate-400 transition-colors"
            onClick={() => onNavigate('logs')}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-slate-700">
                  {formatDate(insight.analysis_date)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {insight.concerns_count > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                    <AlertTriangle className="w-3 h-3" />
                    {insight.concerns_count} concern{insight.concerns_count !== 1 ? 's' : ''}
                  </span>
                )}
                {insight.highlights_count > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                    <TrendingUp className="w-3 h-3" />
                    {insight.highlights_count} highlight{insight.highlights_count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {insight.ai_summary_json?.summary && (
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                  {insight.ai_summary_json.summary}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {insight.concerns_json?.length > 0 && (
                <div className="px-5 py-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Top Concerns</div>
                  <div className="space-y-2">
                    {insight.concerns_json.slice(0, 3).map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-slate-700">{c.location}: </span>
                          <span className="text-xs text-slate-600">{c.issue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {insight.highlights_json?.length > 0 && (
                <div className="px-5 py-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Highlights</div>
                  <div className="space-y-2">
                    {insight.highlights_json.slice(0, 3).map((h, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-slate-700">{h.location}: </span>
                          <span className="text-xs text-slate-600">{h.note}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-1 text-xs text-slate-400">
              View full log analysis <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        )}
      </section>

      {/* Guest Review Alerts Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-800">Guest Review Alerts</h2>
          </div>
          <button
            onClick={() => onNavigate('feedback')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            View Reviews <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {lowReviewLocations.length === 0 ? (
          <div
            className="bg-white rounded-xl border border-emerald-200 p-8 text-center cursor-pointer hover:border-emerald-400 transition-colors"
            onClick={() => onNavigate('feedback')}
          >
            <Star className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
            <p className="text-sm text-emerald-700 font-medium">All locations above threshold</p>
            <p className="text-xs text-slate-400 mt-1">No locations with reviews below 4 stars</p>
          </div>
        ) : (
          <div
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer hover:border-slate-400 transition-colors"
            onClick={() => onNavigate('feedback')}
          >
            <div className="px-5 py-3 border-b border-slate-100 bg-red-50 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-semibold text-red-700">
                {lowReviewLocations.length} location{lowReviewLocations.length !== 1 ? 's' : ''} with reviews below 4 stars
              </span>
            </div>

            <div className="divide-y divide-slate-50">
              {lowReviewLocations.map(loc => (
                <div key={loc.location_name} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-slate-800">{loc.location_name}</span>
                        <div className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          <span className="text-xs font-bold text-slate-600">{loc.avg_rating.toFixed(2)} avg</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {loc.low_categories.map(({ category, minScore }) => (
                          <span
                            key={category}
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
                              minScore <= 2 ? 'bg-red-200 text-red-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {category}
                            <span className="opacity-75">
                              {minScore.toFixed(1)}
                              <Star className="w-2.5 h-2.5 inline ml-0.5 fill-current" />
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 flex-shrink-0 text-right mt-0.5">
                      {formatDate(loc.latest_review_date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-1 text-xs text-slate-400">
              View and manage review alerts <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
