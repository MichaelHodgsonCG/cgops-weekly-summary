import { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, ArrowUpDown, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

type SLPAlert = {
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
};

type AlertsViewProps = {
  weekEndingDate: string;
};

type SortColumn = 'location' | 'variance';
type SortDirection = 'asc' | 'desc';

export default function AlertsView({ weekEndingDate }: AlertsViewProps) {
  const [projectedAboveBudgetAlerts, setProjectedAboveBudgetAlerts] = useState<SLPAlert[]>([]);
  const [labourCautionAlerts, setLabourCautionAlerts] = useState<SLPAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [projectedSortColumn, setProjectedSortColumn] = useState<SortColumn>('variance');
  const [projectedSortDirection, setProjectedSortDirection] = useState<SortDirection>('desc');
  const [cautionSortColumn, setCautionSortColumn] = useState<SortColumn>('variance');
  const [cautionSortDirection, setCautionSortDirection] = useState<SortDirection>('desc');

  const generateAlerts = async () => {
    setLoading(true);

    const { data: reports, error: reportsError } = await supabase
      .from('slp_reports')
      .select('id')
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reportsError || !reports) {
      setLoading(false);
      return;
    }

    const { data: laborData, error: laborError } = await supabase
      .from('slp_labor_data')
      .select('*')
      .eq('report_id', reports.id);

    if (laborError || !laborData) {
      setLoading(false);
      return;
    }

    const projectedAbove: SLPAlert[] = [];
    const cautionList: SLPAlert[] = [];

    laborData.forEach(labor => {
      if (labor.department === 'Manager') return;

      if (
        labor.labour_budget_pct !== null &&
        labor.full_week_labour_projection_pct !== null &&
        labor.full_week_labour_projection_pct > labor.labour_budget_pct
      ) {
        const variance = labor.full_week_labour_projection_pct - labor.labour_budget_pct;
        projectedAbove.push({
          id: `${labor.location_name}-${labor.department}-projected`,
          locationName: labor.location_name,
          department: labor.department,
          alertType: 'projected_above_budget',
          budgetPct: labor.labour_budget_pct,
          projectedPct: labor.full_week_labour_projection_pct,
          wtdDollarsVsSales: null,
          wtdDollarsVsProj: null,
          variance,
          projectedVariancePct: null,
        });
      }

      if (
        labor.wtd_labour_dollars_vs_sales !== null &&
        labor.wtd_labour_dollars_vs_projections !== null &&
        labor.wtd_labour_dollars_vs_sales > 0 &&
        labor.wtd_labour_dollars_vs_projections > 0
      ) {
        const variance = labor.wtd_labour_dollars_vs_sales;
        const projectedVariancePct =
          (labor.labour_budget_pct !== null && labor.full_week_labour_projection_pct !== null)
            ? labor.full_week_labour_projection_pct - labor.labour_budget_pct
            : null;

        cautionList.push({
          id: `${labor.location_name}-${labor.department}-caution`,
          locationName: labor.location_name,
          department: labor.department,
          alertType: 'labour_caution',
          budgetPct: labor.labour_budget_pct,
          projectedPct: labor.full_week_labour_projection_pct,
          wtdDollarsVsSales: labor.wtd_labour_dollars_vs_sales,
          wtdDollarsVsProj: labor.wtd_labour_dollars_vs_projections,
          variance,
          projectedVariancePct,
        });
      }
    });

    setProjectedAboveBudgetAlerts(projectedAbove);
    setLabourCautionAlerts(cautionList);
    setLoading(false);
    setGenerated(true);
  };

  const handleProjectedSort = (column: SortColumn) => {
    if (projectedSortColumn === column) {
      setProjectedSortDirection(projectedSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setProjectedSortColumn(column);
      setProjectedSortDirection('desc');
    }
  };

  const handleCautionSort = (column: SortColumn) => {
    if (cautionSortColumn === column) {
      setCautionSortDirection(cautionSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setCautionSortColumn(column);
      setCautionSortDirection('desc');
    }
  };

  const getSortedAlerts = (alerts: SLPAlert[], sortColumn: SortColumn, sortDirection: SortDirection) => {
    return [...alerts].sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      if (sortColumn === 'location') {
        aValue = a.locationName.toLowerCase();
        bValue = b.locationName.toLowerCase();
      } else {
        aValue = a.variance;
        bValue = b.variance;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const result = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? result : -result;
      }

      const result = (aValue as number) - (bValue as number);
      return sortDirection === 'asc' ? result : -result;
    });
  };

  const SortButton = ({
    column,
    currentColumn,
    currentDirection,
    onClick,
    children
  }: {
    column: SortColumn;
    currentColumn: SortColumn;
    currentDirection: SortDirection;
    onClick: (column: SortColumn) => void;
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => onClick(column)}
      className="flex items-center gap-1 hover:text-slate-700 transition-colors"
    >
      {children}
      <ArrowUpDown className={`w-3 h-3 ${currentColumn === column ? 'text-slate-900' : 'text-slate-400'}`} />
    </button>
  );

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

  const renderProjectedSection = (department: 'BOH' | 'FOH') => {
    const deptAlerts = getSortedAlerts(
      projectedAboveBudgetAlerts.filter(a => a.department === department),
      projectedSortColumn,
      projectedSortDirection
    );

    if (deptAlerts.length === 0) return null;

    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                Projected Above Budget - {department}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {deptAlerts.length} location(s) with projected labour exceeding budget
              </p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <SortButton
                    column="location"
                    currentColumn={projectedSortColumn}
                    currentDirection={projectedSortDirection}
                    onClick={handleProjectedSort}
                  >
                    Location
                  </SortButton>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Budget %
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Projected %
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <SortButton
                    column="variance"
                    currentColumn={projectedSortColumn}
                    currentDirection={projectedSortDirection}
                    onClick={handleProjectedSort}
                  >
                    Variance
                  </SortButton>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {deptAlerts.map(alert => (
                <tr key={alert.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{alert.locationName}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-900">{formatPercent(alert.budgetPct)}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-amber-600">
                    {formatPercent(alert.projectedPct)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                    +{formatPercent(alert.variance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCautionSection = (department: 'BOH' | 'FOH') => {
    const deptAlerts = getSortedAlerts(
      labourCautionAlerts.filter(a => a.department === department),
      cautionSortColumn,
      cautionSortDirection
    );

    if (deptAlerts.length === 0) return null;

    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                Labour Caution - {department}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {deptAlerts.length} location(s) with both WTD $ vs Sales and WTD $ vs Proj positive
              </p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <SortButton
                    column="location"
                    currentColumn={cautionSortColumn}
                    currentDirection={cautionSortDirection}
                    onClick={handleCautionSort}
                  >
                    Location
                  </SortButton>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Projected Labour Variance %
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  WTD $ vs Proj
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <SortButton
                    column="variance"
                    currentColumn={cautionSortColumn}
                    currentDirection={cautionSortDirection}
                    onClick={handleCautionSort}
                  >
                    WTD $ vs Sales
                  </SortButton>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {deptAlerts.map(alert => {
                const varianceValue = alert.projectedVariancePct !== null ? alert.projectedVariancePct : 0;
                const varianceColor = varianceValue < 0 ? 'text-green-600' : 'text-red-600';
                const varianceSign = varianceValue >= 0 ? '+' : '';

                return (
                  <tr key={alert.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{alert.locationName}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${varianceColor}`}>
                      {alert.projectedVariancePct !== null ? `${varianceSign}${alert.projectedVariancePct.toFixed(2)}%` : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                      {formatCurrency(alert.wtdDollarsVsProj)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                      {formatCurrency(alert.wtdDollarsVsSales)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const totalAlerts = projectedAboveBudgetAlerts.length + labourCautionAlerts.length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">SLP Alerts</h3>
            <p className="text-sm text-slate-500 mt-1">
              {generated
                ? `${totalAlerts} ${totalAlerts === 1 ? 'alert' : 'alerts'} detected`
                : 'Click Generate to check for labour alerts'}
            </p>
          </div>
          <button
            onClick={generateAlerts}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Generating...' : generated ? 'Regenerate' : 'Generate Alerts'}
          </button>
        </div>
      </div>

      {!generated && !loading && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <RefreshCw className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Alerts Not Generated</h3>
          <p className="text-slate-500 mb-4">Click the Generate Alerts button to analyse the latest SLP data for labour issues.</p>
          <button
            onClick={generateAlerts}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Generate Alerts
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">Generating alerts...</div>
        </div>
      )}

      {generated && !loading && totalAlerts === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">All Clear!</h3>
          <p className="text-slate-600">No labour alerts detected</p>
        </div>
      )}

      {generated && !loading && totalAlerts > 0 && (
        <>
          {renderProjectedSection('BOH')}
          {renderProjectedSection('FOH')}
          {renderCautionSection('BOH')}
          {renderCautionSection('FOH')}
        </>
      )}

      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-800 mb-2">Alert Definitions</h4>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>
            <span className="font-medium text-slate-800">Projected Above Budget:</span> Full Week Labour Projection % exceeds Labour Budget %
          </li>
          <li>
            <span className="font-medium text-slate-800">Labour Caution:</span> Both WTD Labour $ vs Sales and WTD Labour $ vs Projections are positive
          </li>
        </ul>
      </div>
    </div>
  );
}
