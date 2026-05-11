import { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, FileText, Calendar, ArrowUpDown, AlertTriangle, CheckCircle, Trash2, Info, Pencil, Check, X, MapPin } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { parseSLPCSV, ParsedSLPData } from '../lib/slpParser';
import { useLocationFilter } from '../lib/useLocationFilter';
import { useAuth } from '../lib/auth';

interface SLPReport {
  id: string;
  report_date: string;
  uploaded_at: string;
  file_name: string;
}

type SortDirection = 'asc' | 'desc';

type SLPAlert = {
  id: string;
  locationName: string;
  department: string;
  alertType: 'projected_above_budget' | 'labour_caution';
  severity: 'critical' | 'warning' | 'acceptable' | 'watch' | 'high_priority';
  budgetPct: number | null;
  projectedPct: number | null;
  wtdDollarsVsSales: number | null;
  wtdDollarsVsProj: number | null;
  variance: number;
  projectedVariancePct: number | null;
  salesVariancePct: number | null;
  budgetProximity: number | null;
};

type AlertSortColumn = 'location' | 'variance';

export default function SLPView() {
  const { isAdmin } = useAuth();
  const [reports, setReports] = useState<SLPReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [slpData, setSLPData] = useState<ParsedSLPData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('BOH');

  const [salesSortKey, setSalesSortKey] = useState<string | null>('wtdSalesVsLastYearPct');
  const [salesSortDir, setSalesSortDir] = useState<SortDirection>('desc');
  const [laborSortKey, setLaborSortKey] = useState<string | null>(null);
  const [laborSortDir, setLaborSortDir] = useState<SortDirection>('desc');
  const [promoSortKey, setPromoSortKey] = useState<string | null>(null);
  const [promoSortDir, setPromoSortDir] = useState<SortDirection>('desc');

  const [allAlerts, setAllAlerts] = useState<SLPAlert[]>([]);
  const [highPrioritySortColumn, setHighPrioritySortColumn] = useState<AlertSortColumn>('variance');
  const [highPrioritySortDirection, setHighPrioritySortDirection] = useState<SortDirection>('desc');
  const [criticalSortColumn, setCriticalSortColumn] = useState<AlertSortColumn>('variance');
  const [criticalSortDirection, setCriticalSortDirection] = useState<SortDirection>('desc');
  const [watchSortColumn, setWatchSortColumn] = useState<AlertSortColumn>('variance');
  const [watchSortDirection, setWatchSortDirection] = useState<SortDirection>('desc');

  const [schedulingModalOpen, setSchedulingModalOpen] = useState(false);
  const [criticalModalOpen, setCriticalModalOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [editDateValue, setEditDateValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const locationFilter = useLocationFilter('slp');

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    if (selectedReport) {
      loadReportData(selectedReport);
    }
  }, [selectedReport]);

  async function loadReports() {
    try {
      const { data, error } = await supabase
        .from('slp_reports')
        .select('*')
        .order('report_date', { ascending: false });

      if (error) throw error;
      setReports(data || []);

      if (data && data.length > 0 && !selectedReport) {
        setSelectedReport(data[0].id);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadReportData(reportId: string) {
    try {
      setLoading(true);

      const [salesResponse, laborResponse, promosResponse] = await Promise.all([
        supabase.from('slp_sales_data').select('*').eq('report_id', reportId),
        supabase.from('slp_labor_data').select('*').eq('report_id', reportId),
        supabase.from('slp_promo_data').select('*').eq('report_id', reportId),
      ]);

      if (salesResponse.error) throw salesResponse.error;
      if (laborResponse.error) throw laborResponse.error;
      if (promosResponse.error) throw promosResponse.error;

      const toNumSales = (v: any) => v !== null && v !== undefined ? Number(v) : null;
      const sales = salesResponse.data.map((row: any) => ({
        locationName: row.location_name,
        totalDailySales: toNumSales(row.total_daily_sales),
        totalWtdSales: toNumSales(row.total_wtd_sales),
        dailySalesVsProjections: toNumSales(row.daily_sales_vs_projections),
        wtdSalesVsProjections: toNumSales(row.wtd_sales_vs_projections),
        dailySalesVsLastYear: toNumSales(row.daily_sales_vs_last_year),
        wtdSalesVsLastYear: toNumSales(row.wtd_sales_vs_last_year),
        wtdSalesVsLastYearPct: toNumSales(row.wtd_sales_vs_last_year_pct),
      }));

      const toNum = (v: any) => v !== null && v !== undefined ? Number(v) : null;
      const labour = laborResponse.data.map((row: any) => ({
        locationName: row.location_name,
        department: row.department,
        labourBudgetPct: toNum(row.labour_budget_pct),
        dailyLabourActualPct: toNum(row.daily_labour_actual_pct),
        wtdLabourActualPct: toNum(row.wtd_labour_actual_pct),
        dailyLabourProjectionPct: toNum(row.daily_labour_projection_pct),
        fullWeekLabourProjectionPct: toNum(row.full_week_labour_projection_pct),
        dailyLabourDollarsVsProjections: toNum(row.daily_labour_dollars_vs_projections),
        wtdLabourDollarsVsProjections: toNum(row.wtd_labour_dollars_vs_projections),
        wtdLabourPctVsBudgetPct: toNum(row.wtd_labour_pct_vs_budget_pct),
        wtdLabourDollarsVsSales: toNum(row.wtd_labour_dollars_vs_sales),
        wtdLabourDollars: toNum(row.wtd_labour_dollars),
      }));

      const promos = promosResponse.data.map((row: any) => ({
        locationName: row.location_name,
        relationshipDollars: row.relationship_dollars,
        substandardDollars: row.substandard_dollars,
        totalPromoPct: row.total_promo_pct,
      }));

      setSLPData({ sales, labour, promos });
      generateAlerts(salesResponse.data, laborResponse.data);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  }

  function generateAlerts(salesData: any[], laborData: any[]) {
    const alerts: SLPAlert[] = [];
    const salesMap = new Map(salesData.map(s => [s.location_name, s]));

    laborData.forEach(labour => {
      if (labour.department === 'Manager') return;

      const sales = salesMap.get(labour.location_name);
      const budgetProximity =
        labour.labour_budget_pct !== null && labour.full_week_labour_projection_pct !== null
          ? Math.abs(labour.full_week_labour_projection_pct - labour.labour_budget_pct)
          : null;

      if (
        labour.labour_budget_pct !== null &&
        labour.full_week_labour_projection_pct !== null &&
        labour.full_week_labour_projection_pct > labour.labour_budget_pct
      ) {
        const variance = labour.full_week_labour_projection_pct - labour.labour_budget_pct;

        // Calculate WTD Sales vs Projected percentage
        const salesVariancePct = (sales && sales.total_wtd_sales && sales.wtd_sales_vs_projections !== null)
          ? (sales.wtd_sales_vs_projections / sales.total_wtd_sales) * 100
          : null;

        alerts.push({
          id: `${labour.location_name}-${labour.department}-projected`,
          locationName: labour.location_name,
          department: labour.department,
          alertType: 'projected_above_budget',
          severity: 'high_priority',
          budgetPct: labour.labour_budget_pct,
          projectedPct: labour.full_week_labour_projection_pct,
          wtdDollarsVsSales: labour.wtd_labour_dollars_vs_sales,
          wtdDollarsVsProj: labour.wtd_labour_dollars_vs_projections,
          variance,
          projectedVariancePct: variance,
          salesVariancePct,
          budgetProximity,
        });
      }

      if (
        labour.wtd_labour_dollars_vs_sales !== null &&
        labour.wtd_labour_dollars_vs_projections !== null &&
        labour.wtd_labour_dollars_vs_sales > 0 &&
        labour.wtd_labour_dollars_vs_projections > 0
      ) {
        const variance = labour.wtd_labour_dollars_vs_sales;
        const projectedVariancePct =
          (labour.labour_budget_pct !== null && labour.full_week_labour_projection_pct !== null)
            ? labour.full_week_labour_projection_pct - labour.labour_budget_pct
            : null;

        // Calculate WTD Sales vs Projected percentage
        const salesVariancePct = (sales && sales.total_wtd_sales && sales.wtd_sales_vs_projections !== null)
          ? (sales.wtd_sales_vs_projections / sales.total_wtd_sales) * 100
          : null;

        const salesAreDown = salesVariancePct !== null && salesVariancePct < 0;
        const salesAreUp = salesVariancePct !== null && salesVariancePct > 0;
        const withinBudgetProximity = budgetProximity !== null && budgetProximity <= 0.25;
        const wellBelowBudget = projectedVariancePct !== null && projectedVariancePct < -0.25;

        let severity: 'critical' | 'warning' | 'acceptable' | 'watch';

        if (salesAreDown) {
          severity = 'critical';
        } else if (withinBudgetProximity) {
          severity = 'warning';
        } else if (salesAreUp) {
          severity = 'acceptable';
        } else if (wellBelowBudget) {
          severity = 'watch';
        } else {
          severity = 'warning';
        }

        alerts.push({
          id: `${labour.location_name}-${labour.department}-caution`,
          locationName: labour.location_name,
          department: labour.department,
          alertType: 'labour_caution',
          severity,
          budgetPct: labour.labour_budget_pct,
          projectedPct: labour.full_week_labour_projection_pct,
          wtdDollarsVsSales: labour.wtd_labour_dollars_vs_sales,
          wtdDollarsVsProj: labour.wtd_labour_dollars_vs_projections,
          variance,
          projectedVariancePct,
          salesVariancePct,
          budgetProximity,
        });
      }
    });

    setAllAlerts(alerts);
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      let csvText: string;
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        csvText = XLSX.utils.sheet_to_csv(sheet);
      } else {
        csvText = await file.text();
      }

      const parsed = parseSLPCSV(csvText);

      // Extract date from first line of CSV or use current date
      const firstLine = csvText.split('\n')[0];

      // Try to find date in various formats
      // Format 1: DD/MM/YYYY or MM/DD/YYYY
      let dateMatch = firstLine.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);

      let reportDate: string;
      if (dateMatch) {
        const part1 = dateMatch[1].padStart(2, '0');
        const part2 = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3];

        // Assume MM/DD/YYYY format (US standard)
        // If first part > 12, then it must be DD/MM/YYYY
        const month = parseInt(part1) > 12 ? part2 : part1;
        const day = parseInt(part1) > 12 ? part1 : part2;

        reportDate = `${year}-${month}-${day}`;
      } else {
        // Use current date in ET timezone
        const now = new Date();
        const etDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const year = etDate.getFullYear();
        const month = String(etDate.getMonth() + 1).padStart(2, '0');
        const day = String(etDate.getDate()).padStart(2, '0');
        reportDate = `${year}-${month}-${day}`;
      }

      const { data: report, error: reportError } = await supabase
        .from('slp_reports')
        .insert({
          report_date: reportDate,
          file_name: file.name,
        })
        .select()
        .single();

      if (reportError) throw reportError;

      const salesInserts = parsed.sales.map((s) => ({
        report_id: report.id,
        location_name: s.locationName,
        total_daily_sales: s.totalDailySales,
        total_wtd_sales: s.totalWtdSales,
        daily_sales_vs_projections: s.dailySalesVsProjections,
        wtd_sales_vs_projections: s.wtdSalesVsProjections,
        daily_sales_vs_last_year: s.dailySalesVsLastYear,
        wtd_sales_vs_last_year: s.wtdSalesVsLastYear,
        wtd_sales_vs_last_year_pct: s.wtdSalesVsLastYearPct,
      }));

      const labourInserts = parsed.labour.map((l) => ({
        report_id: report.id,
        location_name: l.locationName,
        department: l.department,
        labour_budget_pct: l.labourBudgetPct,
        daily_labour_actual_pct: l.dailyLabourActualPct,
        wtd_labour_actual_pct: l.wtdLabourActualPct,
        daily_labour_projection_pct: l.dailyLabourProjectionPct,
        full_week_labour_projection_pct: l.fullWeekLabourProjectionPct,
        daily_labour_dollars_vs_projections: l.dailyLabourDollarsVsProjections,
        wtd_labour_dollars_vs_projections: l.wtdLabourDollarsVsProjections,
        wtd_labour_pct_vs_budget_pct: l.wtdLabourPctVsBudgetPct,
        wtd_labour_dollars_vs_sales: l.wtdLabourDollarsVsSales,
      }));

      const promoInserts = parsed.promos.map((p) => ({
        report_id: report.id,
        location_name: p.locationName,
        relationship_dollars: p.relationshipDollars,
        substandard_dollars: p.substandardDollars,
        total_promo_pct: p.totalPromoPct,
      }));

      await Promise.all([
        supabase.from('slp_sales_data').insert(salesInserts),
        supabase.from('slp_labor_data').insert(labourInserts),
        supabase.from('slp_promo_data').insert(promoInserts),
      ]);

      await loadReports();
      setSelectedReport(report.id);
      alert('SLP report uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading file:', error);
      console.error('Error details:', error.message, error.stack);
      const errorMsg = error.message || 'Unknown error';
      alert(`Error uploading file: ${errorMsg}\n\nPlease check the format and try again.`);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function handleDeleteReport() {
    if (!selectedReport) return;

    const report = reports.find(r => r.id === selectedReport);
    if (!report) return;

    const confirmMsg = `Are you sure you want to delete the report from ${new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}?`;
    if (!confirm(confirmMsg)) return;

    try {
      const { error } = await supabase.from('slp_reports').delete().eq('id', selectedReport);

      if (error) throw error;

      await loadReports();
      alert('Report deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting report:', error);
      alert(`Error deleting report: ${error.message}`);
    }
  }

  function startEditingName() {
    const report = reports.find(r => r.id === selectedReport);
    if (!report) return;
    setEditNameValue(report.file_name);
    setEditDateValue(report.report_date);
    setEditingName(true);
    setTimeout(() => editInputRef.current?.select(), 50);
  }

  async function saveEditedName() {
    if (!selectedReport || !editNameValue.trim() || !editDateValue) return;
    try {
      const { error } = await supabase
        .from('slp_reports')
        .update({ file_name: editNameValue.trim(), report_date: editDateValue })
        .eq('id', selectedReport);
      if (error) throw error;
      await loadReports();
      setEditingName(false);
    } catch (error: any) {
      alert(`Error updating report: ${error.message}`);
    }
  }

  function cancelEditingName() {
    setEditingName(false);
    setEditNameValue('');
    setEditDateValue('');
  }

  function formatCurrency(value: number | null): string {
    if (value === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatPercent(value: number | null): string {
    if (value === null) return '-';
    return `${value.toFixed(2)}%`;
  }

  function formatNumber(value: number | null): string {
    if (value === null) return '-';
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const departments = ['BOH', 'FOH', 'Manager'];
  const salesByLocation = new Map((slpData?.sales || []).map(s => [s.locationName, s]));
  const departmentLabour = (slpData?.labour.filter(l => l.department === selectedDepartment) || []).map(l => {
    const sales = salesByLocation.get(l.locationName);
    const storedDollars = l.wtdLabourDollars !== null && l.wtdLabourDollars !== undefined ? Number(l.wtdLabourDollars) : null;
    const actualPct = l.wtdLabourActualPct !== null && l.wtdLabourActualPct !== undefined ? Number(l.wtdLabourActualPct) : null;
    const wtdSales = sales?.totalWtdSales !== null && sales?.totalWtdSales !== undefined ? Number(sales.totalWtdSales) : null;
    const computedWtdLabourDollars = storedDollars !== null && !isNaN(storedDollars)
      ? storedDollars
      : (actualPct !== null && !isNaN(actualPct) && wtdSales !== null && !isNaN(wtdSales))
        ? (actualPct / 100) * wtdSales
        : null;
    return { ...l, wtdLabourDollars: computedWtdLabourDollars };
  });

  const sortData = <T extends Record<string, any>>(data: T[], key: string | null, direction: SortDirection): T[] => {
    if (!key) return data;

    return [...data].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string') {
        return direction === 'desc'
          ? bVal.localeCompare(aVal)
          : aVal.localeCompare(bVal);
      }

      return direction === 'desc' ? bVal - aVal : aVal - bVal;
    });
  };

  const handleSort = (
    currentKey: string | null,
    currentDir: SortDirection,
    newKey: string,
    setSortKey: (key: string | null) => void,
    setSortDir: (dir: SortDirection) => void
  ) => {
    if (currentKey === newKey) {
      setSortDir(currentDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(newKey);
      setSortDir('desc');
    }
  };

  const SortButton = ({
    children,
    sortKey,
    currentSortKey,
    currentSortDir,
    onSort
  }: {
    children: React.ReactNode;
    sortKey: string;
    currentSortKey: string | null;
    currentSortDir: SortDirection;
    onSort: () => void;
  }) => (
    <button
      onClick={onSort}
      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
    >
      {children}
      <ArrowUpDown className={`w-3 h-3 ${currentSortKey === sortKey ? 'text-blue-600' : 'text-gray-400'}`} />
    </button>
  );

  const TOTAL_KEY = '__TOTAL__';
  const salesRows = (slpData?.sales || []).filter(s => s.locationName !== TOTAL_KEY);
  const labourRows = departmentLabour.filter(l => l.locationName !== TOTAL_KEY);
  const promoRows = (slpData?.promos || []).filter(p => p.locationName !== TOTAL_KEY);

  const filteredSalesRows = useMemo(() => {
    if (!locationFilter.isFiltered || !locationFilter.hasPreferences) return salesRows;
    return salesRows.filter(s => locationFilter.preferredLocations.includes(s.locationName));
  }, [salesRows, locationFilter.isFiltered, locationFilter.hasPreferences, locationFilter.preferredLocations]);

  const filteredLabourRows = useMemo(() => {
    if (!locationFilter.isFiltered || !locationFilter.hasPreferences) return labourRows;
    return labourRows.filter(l => locationFilter.preferredLocations.includes(l.locationName));
  }, [labourRows, locationFilter.isFiltered, locationFilter.hasPreferences, locationFilter.preferredLocations]);

  const filteredPromoRows = useMemo(() => {
    if (!locationFilter.isFiltered || !locationFilter.hasPreferences) return promoRows;
    return promoRows.filter(p => locationFilter.preferredLocations.includes(p.locationName));
  }, [promoRows, locationFilter.isFiltered, locationFilter.hasPreferences, locationFilter.preferredLocations]);

  const sortedSales = sortData(filteredSalesRows, salesSortKey, salesSortDir);
  const sortedLabour = sortData(filteredLabourRows, laborSortKey, laborSortDir);
  const sortedPromos = sortData(filteredPromoRows, promoSortKey, promoSortDir);

  const totalSalesRow = (slpData?.sales || []).find(s => s.locationName === TOTAL_KEY);
  const totalLabourRow = departmentLabour.find(l => l.locationName === TOTAL_KEY);
  const totalPromoRow = (slpData?.promos || []).find(p => p.locationName === TOTAL_KEY);

  const salesTotals = {
    totalDailySales: totalSalesRow?.totalDailySales ?? null,
    totalWtdSales: totalSalesRow?.totalWtdSales ?? null,
    dailySalesVsProjections: totalSalesRow?.dailySalesVsProjections ?? null,
    wtdSalesVsProjections: totalSalesRow?.wtdSalesVsProjections ?? null,
    dailySalesVsLastYear: totalSalesRow?.dailySalesVsLastYear ?? null,
    wtdSalesVsLastYear: totalSalesRow?.wtdSalesVsLastYear ?? null,
  };

  const wtdSalesVsLastYearPct = totalSalesRow?.wtdSalesVsLastYearPct ?? null;

  const laborTotals = {
    wtdLabourDollars: totalLabourRow?.wtdLabourDollars ?? null,
    wtdLabourDollarsVsSales: totalLabourRow?.wtdLabourDollarsVsSales ?? null,
    wtdLabourDollarsVsProj: totalLabourRow?.wtdLabourDollarsVsProjections ?? null,
    labourBudgetPct: totalLabourRow?.labourBudgetPct ?? null,
    dailyLabourActualPct: totalLabourRow?.dailyLabourActualPct ?? null,
    wtdLabourActualPct: totalLabourRow?.wtdLabourActualPct ?? null,
    fullWeekLabourProjectionPct: totalLabourRow?.fullWeekLabourProjectionPct ?? null,
    dailyLabourDollarsVsProjections: totalLabourRow?.dailyLabourDollarsVsProjections ?? null,
    wtdLabourPctVsBudgetPct: totalLabourRow?.wtdLabourPctVsBudgetPct ?? null,
  };

  const promoTotals = {
    relationshipDollars: totalPromoRow?.relationshipDollars ?? null,
    substandardDollars: totalPromoRow?.substandardDollars ?? null,
  };

  const handleHighPrioritySort = (column: AlertSortColumn) => {
    if (highPrioritySortColumn === column) {
      setHighPrioritySortDirection(highPrioritySortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setHighPrioritySortColumn(column);
      setHighPrioritySortDirection('desc');
    }
  };


  const getSortedAlerts = (alerts: SLPAlert[], sortColumn: AlertSortColumn, sortDirection: SortDirection) => {
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

  const AlertSortButton = ({
    column,
    currentColumn,
    currentDirection,
    onClick,
    children
  }: {
    column: AlertSortColumn;
    currentColumn: AlertSortColumn;
    currentDirection: SortDirection;
    onClick: (column: AlertSortColumn) => void;
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => onClick(column)}
      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
    >
      {children}
      <ArrowUpDown className={`w-3 h-3 ${currentColumn === column ? 'text-blue-600' : 'text-gray-400'}`} />
    </button>
  );

  const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
      <div className="relative inline-block">
        <button
          type="button"
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
          onClick={() => setIsVisible(!isVisible)}
          className="inline-flex items-center"
        >
          {children}
        </button>
        {isVisible && (
          <div className="absolute z-10 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64">
            {text}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSchedulingModal = () => {
    if (!schedulingModalOpen) return null;

    const bohAlerts = getSortedAlerts(
      allAlerts.filter(a => a.department === 'BOH' && a.severity === 'high_priority'),
      highPrioritySortColumn,
      highPrioritySortDirection
    );
    const fohAlerts = getSortedAlerts(
      allAlerts.filter(a => a.department === 'FOH' && a.severity === 'high_priority'),
      highPrioritySortColumn,
      highPrioritySortDirection
    );

    const totalAlerts = bohAlerts.length + fohAlerts.length;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] sm:max-h-[80vh] flex flex-col overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-red-50 border-b border-red-200 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">
                Scheduling Alerts ({totalAlerts})
              </h3>
              <Tooltip text="Full Week Labour Projection % exceeds Labour Budget %">
                <Info className="w-4 h-4 text-gray-500 hover:text-gray-700 cursor-help flex-shrink-0" />
              </Tooltip>
            </div>
            <button
              onClick={() => setSchedulingModalOpen(false)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {bohAlerts.length > 0 && (
              <div className="border-b border-gray-200">
                <div className="px-6 py-3 bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700">Back of House ({bohAlerts.length})</h4>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-[49px] z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <AlertSortButton
                          column="location"
                          currentColumn={highPrioritySortColumn}
                          currentDirection={highPrioritySortDirection}
                          onClick={handleHighPrioritySort}
                        >
                          Location
                        </AlertSortButton>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Budget %
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Projected %
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <AlertSortButton
                          column="variance"
                          currentColumn={highPrioritySortColumn}
                          currentDirection={highPrioritySortDirection}
                          onClick={handleHighPrioritySort}
                        >
                          Variance
                        </AlertSortButton>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bohAlerts.map(alert => (
                      <tr key={alert.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{alert.locationName}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">{formatPercent(alert.budgetPct)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
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
            )}
            {fohAlerts.length > 0 && (
              <div>
                <div className="px-6 py-3 bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700">Front of House ({fohAlerts.length})</h4>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-[49px] z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <AlertSortButton
                          column="location"
                          currentColumn={highPrioritySortColumn}
                          currentDirection={highPrioritySortDirection}
                          onClick={handleHighPrioritySort}
                        >
                          Location
                        </AlertSortButton>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Budget %
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Projected %
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <AlertSortButton
                          column="variance"
                          currentColumn={highPrioritySortColumn}
                          currentDirection={highPrioritySortDirection}
                          onClick={handleHighPrioritySort}
                        >
                          Variance
                        </AlertSortButton>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {fohAlerts.map(alert => (
                      <tr key={alert.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{alert.locationName}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">{formatPercent(alert.budgetPct)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
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
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleCriticalSort = (column: AlertSortColumn) => {
    if (criticalSortColumn === column) {
      setCriticalSortDirection(criticalSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setCriticalSortColumn(column);
      setCriticalSortDirection('desc');
    }
  };


  const renderCriticalModal = () => {
    if (!criticalModalOpen) return null;

    const bohAlerts = getSortedAlerts(
      allAlerts.filter(a => a.department === 'BOH' && a.severity === 'critical'),
      criticalSortColumn,
      criticalSortDirection
    );
    const fohAlerts = getSortedAlerts(
      allAlerts.filter(a => a.department === 'FOH' && a.severity === 'critical'),
      criticalSortColumn,
      criticalSortDirection
    );

    const totalAlerts = bohAlerts.length + fohAlerts.length;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] sm:max-h-[80vh] flex flex-col overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-red-50 border-b border-red-300 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-700 flex-shrink-0" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">
                Critical Concern ({totalAlerts})
              </h3>
              <Tooltip text="Sales are down AND labour spending is over budget - immediate attention required">
                <Info className="w-4 h-4 text-gray-500 hover:text-gray-700 cursor-help flex-shrink-0" />
              </Tooltip>
            </div>
            <button
              onClick={() => setCriticalModalOpen(false)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {bohAlerts.length > 0 && (
              <div className="border-b border-gray-200">
                <div className="px-6 py-3 bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700">Back of House ({bohAlerts.length})</h4>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-[49px] z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <AlertSortButton
                            column="location"
                            currentColumn={criticalSortColumn}
                            currentDirection={criticalSortDirection}
                            onClick={handleCriticalSort}
                          >
                            Location
                          </AlertSortButton>
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          WTD Sales vs Proj %
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Labour Var %
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          WTD $ vs Proj
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <AlertSortButton
                            column="variance"
                            currentColumn={criticalSortColumn}
                            currentDirection={criticalSortDirection}
                            onClick={handleCriticalSort}
                          >
                            WTD $ vs Sales
                          </AlertSortButton>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {bohAlerts.map(alert => (
                        <tr key={alert.id} className="hover:bg-red-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{alert.locationName}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-red-700">
                            {alert.salesVariancePct !== null ? `${alert.salesVariancePct.toFixed(2)}%` : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-red-700">
                            {alert.projectedVariancePct !== null ? `${alert.projectedVariancePct >= 0 ? '+' : ''}${alert.projectedVariancePct.toFixed(2)}%` : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-red-700">
                            {formatCurrency(alert.wtdDollarsVsProj)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-red-700">
                            {formatCurrency(alert.wtdDollarsVsSales)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
            )}
            {fohAlerts.length > 0 && (
              <div>
                <div className="px-6 py-3 bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700">Front of House ({fohAlerts.length})</h4>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-[49px] z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <AlertSortButton
                            column="location"
                            currentColumn={criticalSortColumn}
                            currentDirection={criticalSortDirection}
                            onClick={handleCriticalSort}
                          >
                            Location
                          </AlertSortButton>
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          WTD Sales vs Proj %
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Labour Var %
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          WTD $ vs Proj
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <AlertSortButton
                            column="variance"
                            currentColumn={criticalSortColumn}
                            currentDirection={criticalSortDirection}
                            onClick={handleCriticalSort}
                          >
                            WTD $ vs Sales
                          </AlertSortButton>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {fohAlerts.map(alert => (
                        <tr key={alert.id} className="hover:bg-red-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{alert.locationName}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-red-700">
                            {alert.salesVariancePct !== null ? `${alert.salesVariancePct.toFixed(2)}%` : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-red-700">
                            {alert.projectedVariancePct !== null ? `${alert.projectedVariancePct >= 0 ? '+' : ''}${alert.projectedVariancePct.toFixed(2)}%` : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-red-700">
                            {formatCurrency(alert.wtdDollarsVsProj)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-red-700">
                            {formatCurrency(alert.wtdDollarsVsSales)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };



  const totalAlerts = allAlerts.length;

  if (loading && reports.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">SLP - Daily Labour Report</h2>
          <p className="mt-1 text-sm text-gray-500">Upload and view daily labour performance reports</p>
        </div>

        <div className="flex items-center gap-2">
          {locationFilter.hasPreferences && (
            <button
              onClick={() => locationFilter.setIsFiltered(!locationFilter.isFiltered)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                locationFilter.isFiltered
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              {locationFilter.isFiltered ? 'My Locations' : 'All Locations'}
            </button>
          )}
          {isAdmin && (
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
              <Upload className="w-5 h-5" />
              <span>{uploading ? 'Uploading...' : 'Upload Report'}</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {reports.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-gray-700">
            <Calendar className="w-5 h-5" />
            <span className="font-medium">Report Date:</span>
          </div>
          {editingName ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={editDateValue}
                onChange={(e) => setEditDateValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancelEditingName();
                }}
                className="px-3 py-2 border border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <input
                ref={editInputRef}
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEditedName();
                  if (e.key === 'Escape') cancelEditingName();
                }}
                className="px-3 py-2 border border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-56 text-sm"
                placeholder="Enter report name..."
              />
              <button
                onClick={saveEditedName}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Save"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={cancelEditingName}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <select
                value={selectedReport || ''}
                onChange={(e) => setSelectedReport(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {reports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} - {report.file_name}
                  </option>
                ))}
              </select>
              <button
                onClick={startEditingName}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Rename selected report"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={handleDeleteReport}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete selected report"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Reports Yet</h3>
          <p className="text-gray-500 mb-6">Upload your first SLP report to get started</p>
        </div>
      ) : slpData ? (
        <div className="space-y-6">
          {renderSchedulingModal()}
          {renderCriticalModal()}

          {totalAlerts > 0 && (
            <div className="flex items-center gap-4">
              {allAlerts.filter(a => a.severity === 'high_priority').length > 0 && (
                <button
                  onClick={() => setSchedulingModalOpen(true)}
                  className="relative flex items-center gap-2 px-4 py-2 bg-red-50 border-2 border-red-300 rounded-lg hover:bg-red-100 transition-colors group"
                >
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold text-gray-800">Scheduling Alerts</span>
                    <span className="text-xs text-gray-600">
                      {allAlerts.filter(a => a.severity === 'high_priority').length} alerts (BOH: {allAlerts.filter(a => a.severity === 'high_priority' && a.department === 'BOH').length}, FOH: {allAlerts.filter(a => a.severity === 'high_priority' && a.department === 'FOH').length})
                    </span>
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {allAlerts.filter(a => a.severity === 'high_priority').length}
                  </span>
                </button>
              )}

              {(allAlerts.filter(a => a.severity === 'critical').length > 0) && (
                <button
                  onClick={() => setCriticalModalOpen(true)}
                  className="relative flex items-center gap-2 px-4 py-2 bg-red-50 border-2 border-red-500 rounded-lg hover:bg-red-100 transition-colors group"
                >
                  <AlertTriangle className="w-5 h-5 text-red-700" />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold text-gray-800">Critical Concern</span>
                    <span className="text-xs text-gray-600">
                      {allAlerts.filter(a => a.severity === 'critical').length} alerts
                    </span>
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 bg-red-700 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {allAlerts.filter(a => a.severity === 'critical').length}
                  </span>
                </button>
              )}
            </div>
          )}

          {totalAlerts === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">All Clear!</h3>
              <p className="text-gray-600">No labour alerts detected</p>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm overflow-hidden max-w-full">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Sales Performance</h3>
            </div>
            <div className="overflow-x-auto -mx-0">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="locationName"
                        currentSortKey={salesSortKey}
                        currentSortDir={salesSortDir}
                        onSort={() => handleSort(salesSortKey, salesSortDir, 'locationName', setSalesSortKey, setSalesSortDir)}
                      >
                        Location
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="totalDailySales"
                        currentSortKey={salesSortKey}
                        currentSortDir={salesSortDir}
                        onSort={() => handleSort(salesSortKey, salesSortDir, 'totalDailySales', setSalesSortKey, setSalesSortDir)}
                      >
                        Daily Sales
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="totalWtdSales"
                        currentSortKey={salesSortKey}
                        currentSortDir={salesSortDir}
                        onSort={() => handleSort(salesSortKey, salesSortDir, 'totalWtdSales', setSalesSortKey, setSalesSortDir)}
                      >
                        WTD Sales
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="dailySalesVsProjections"
                        currentSortKey={salesSortKey}
                        currentSortDir={salesSortDir}
                        onSort={() => handleSort(salesSortKey, salesSortDir, 'dailySalesVsProjections', setSalesSortKey, setSalesSortDir)}
                      >
                        Daily vs Proj
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="wtdSalesVsProjections"
                        currentSortKey={salesSortKey}
                        currentSortDir={salesSortDir}
                        onSort={() => handleSort(salesSortKey, salesSortDir, 'wtdSalesVsProjections', setSalesSortKey, setSalesSortDir)}
                      >
                        WTD vs Proj
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="dailySalesVsLastYear"
                        currentSortKey={salesSortKey}
                        currentSortDir={salesSortDir}
                        onSort={() => handleSort(salesSortKey, salesSortDir, 'dailySalesVsLastYear', setSalesSortKey, setSalesSortDir)}
                      >
                        Daily vs LY
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="wtdSalesVsLastYear"
                        currentSortKey={salesSortKey}
                        currentSortDir={salesSortDir}
                        onSort={() => handleSort(salesSortKey, salesSortDir, 'wtdSalesVsLastYear', setSalesSortKey, setSalesSortDir)}
                      >
                        WTD vs LY
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="wtdSalesVsLastYearPct"
                        currentSortKey={salesSortKey}
                        currentSortDir={salesSortDir}
                        onSort={() => handleSort(salesSortKey, salesSortDir, 'wtdSalesVsLastYearPct', setSalesSortKey, setSalesSortDir)}
                      >
                        WTD vs LY %
                      </SortButton>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr className="bg-slate-100 font-semibold border-b-2 border-slate-300">
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatCurrency(salesTotals.totalDailySales)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatCurrency(salesTotals.totalWtdSales)}</td>
                    <td className={`px-4 py-3 text-sm text-right font-bold ${salesTotals.dailySalesVsProjections >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(salesTotals.dailySalesVsProjections)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-bold ${salesTotals.wtdSalesVsProjections >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(salesTotals.wtdSalesVsProjections)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-bold ${salesTotals.dailySalesVsLastYear >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(salesTotals.dailySalesVsLastYear)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-bold ${salesTotals.wtdSalesVsLastYear >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(salesTotals.wtdSalesVsLastYear)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-bold ${wtdSalesVsLastYearPct && wtdSalesVsLastYearPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {wtdSalesVsLastYearPct !== null ? formatPercent(wtdSalesVsLastYearPct) : '-'}
                    </td>
                  </tr>
                  {sortedSales.map((sale, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{sale.locationName}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(sale.totalDailySales)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(sale.totalWtdSales)}</td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${sale.dailySalesVsProjections && sale.dailySalesVsProjections >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(sale.dailySalesVsProjections)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${sale.wtdSalesVsProjections && sale.wtdSalesVsProjections >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(sale.wtdSalesVsProjections)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${sale.dailySalesVsLastYear && sale.dailySalesVsLastYear >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(sale.dailySalesVsLastYear)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${sale.wtdSalesVsLastYear && sale.wtdSalesVsLastYear >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(sale.wtdSalesVsLastYear)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${sale.wtdSalesVsLastYearPct && sale.wtdSalesVsLastYearPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(sale.wtdSalesVsLastYearPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden max-w-full">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Labour Performance</h3>
              <div className="flex gap-2">
                {departments.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setSelectedDepartment(dept)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedDepartment === dept
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto -mx-0">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="locationName"
                        currentSortKey={laborSortKey}
                        currentSortDir={laborSortDir}
                        onSort={() => handleSort(laborSortKey, laborSortDir, 'locationName', setLaborSortKey, setLaborSortDir)}
                      >
                        Location
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="wtdLabourDollars"
                        currentSortKey={laborSortKey}
                        currentSortDir={laborSortDir}
                        onSort={() => handleSort(laborSortKey, laborSortDir, 'wtdLabourDollars', setLaborSortKey, setLaborSortDir)}
                      >
                        Total Labour $
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="labourBudgetPct"
                        currentSortKey={laborSortKey}
                        currentSortDir={laborSortDir}
                        onSort={() => handleSort(laborSortKey, laborSortDir, 'labourBudgetPct', setLaborSortKey, setLaborSortDir)}
                      >
                        Budget %
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="dailyLabourActualPct"
                        currentSortKey={laborSortKey}
                        currentSortDir={laborSortDir}
                        onSort={() => handleSort(laborSortKey, laborSortDir, 'dailyLabourActualPct', setLaborSortKey, setLaborSortDir)}
                      >
                        Daily Actual %
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="wtdLabourActualPct"
                        currentSortKey={laborSortKey}
                        currentSortDir={laborSortDir}
                        onSort={() => handleSort(laborSortKey, laborSortDir, 'wtdLabourActualPct', setLaborSortKey, setLaborSortDir)}
                      >
                        WTD Actual %
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="fullWeekLabourProjectionPct"
                        currentSortKey={laborSortKey}
                        currentSortDir={laborSortDir}
                        onSort={() => handleSort(laborSortKey, laborSortDir, 'fullWeekLabourProjectionPct', setLaborSortKey, setLaborSortDir)}
                      >
                        Full Week Proj %
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="dailyLabourDollarsVsProjections"
                        currentSortKey={laborSortKey}
                        currentSortDir={laborSortDir}
                        onSort={() => handleSort(laborSortKey, laborSortDir, 'dailyLabourDollarsVsProjections', setLaborSortKey, setLaborSortDir)}
                      >
                        Daily $ vs Proj
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="wtdLabourDollarsVsProjections"
                        currentSortKey={laborSortKey}
                        currentSortDir={laborSortDir}
                        onSort={() => handleSort(laborSortKey, laborSortDir, 'wtdLabourDollarsVsProjections', setLaborSortKey, setLaborSortDir)}
                      >
                        WTD $ vs Proj
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="wtdLabourPctVsBudgetPct"
                        currentSortKey={laborSortKey}
                        currentSortDir={laborSortDir}
                        onSort={() => handleSort(laborSortKey, laborSortDir, 'wtdLabourPctVsBudgetPct', setLaborSortKey, setLaborSortDir)}
                      >
                        WTD % vs Budget
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="wtdLabourDollarsVsSales"
                        currentSortKey={laborSortKey}
                        currentSortDir={laborSortDir}
                        onSort={() => handleSort(laborSortKey, laborSortDir, 'wtdLabourDollarsVsSales', setLaborSortKey, setLaborSortDir)}
                      >
                        WTD $ vs Sales
                      </SortButton>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr className="bg-slate-100 font-semibold border-b-2 border-slate-300">
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatCurrency(laborTotals.wtdLabourDollars)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatPercent(laborTotals.labourBudgetPct)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatPercent(laborTotals.dailyLabourActualPct)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatPercent(laborTotals.wtdLabourActualPct)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatPercent(laborTotals.fullWeekLabourProjectionPct)}</td>
                    <td className={`px-4 py-3 text-sm text-right font-bold ${laborTotals.dailyLabourDollarsVsProjections !== null && laborTotals.dailyLabourDollarsVsProjections >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(laborTotals.dailyLabourDollarsVsProjections)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-bold ${laborTotals.wtdLabourDollarsVsProj !== null && laborTotals.wtdLabourDollarsVsProj >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(laborTotals.wtdLabourDollarsVsProj)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-bold ${laborTotals.wtdLabourPctVsBudgetPct !== null && laborTotals.wtdLabourPctVsBudgetPct >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatPercent(laborTotals.wtdLabourPctVsBudgetPct)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-bold ${laborTotals.wtdLabourDollarsVsSales !== null && laborTotals.wtdLabourDollarsVsSales >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(laborTotals.wtdLabourDollarsVsSales)}
                    </td>
                  </tr>
                  {sortedLabour.map((labour, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{labour.locationName}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(labour.wtdLabourDollars)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{formatPercent(labour.labourBudgetPct)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{formatPercent(labour.dailyLabourActualPct)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{formatPercent(labour.wtdLabourActualPct)}</td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${labour.fullWeekLabourProjectionPct && labour.labourBudgetPct && labour.fullWeekLabourProjectionPct > labour.labourBudgetPct ? 'text-red-600' : 'text-gray-900'}`}>
                        {formatPercent(labour.fullWeekLabourProjectionPct)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${labour.dailyLabourDollarsVsProjections && labour.dailyLabourDollarsVsProjections >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(labour.dailyLabourDollarsVsProjections)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${labour.wtdLabourDollarsVsProjections && labour.wtdLabourDollarsVsProjections >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(labour.wtdLabourDollarsVsProjections)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${labour.wtdLabourPctVsBudgetPct && labour.wtdLabourPctVsBudgetPct >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatPercent(labour.wtdLabourPctVsBudgetPct)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${labour.wtdLabourDollarsVsSales && labour.wtdLabourDollarsVsSales >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(labour.wtdLabourDollarsVsSales)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden max-w-full">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Promotions</h3>
            </div>
            <div className="overflow-x-auto -mx-0">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="locationName"
                        currentSortKey={promoSortKey}
                        currentSortDir={promoSortDir}
                        onSort={() => handleSort(promoSortKey, promoSortDir, 'locationName', setPromoSortKey, setPromoSortDir)}
                      >
                        Location
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="relationshipDollars"
                        currentSortKey={promoSortKey}
                        currentSortDir={promoSortDir}
                        onSort={() => handleSort(promoSortKey, promoSortDir, 'relationshipDollars', setPromoSortKey, setPromoSortDir)}
                      >
                        Relationship $
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="substandardDollars"
                        currentSortKey={promoSortKey}
                        currentSortDir={promoSortDir}
                        onSort={() => handleSort(promoSortKey, promoSortDir, 'substandardDollars', setPromoSortKey, setPromoSortDir)}
                      >
                        Substandard $
                      </SortButton>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <SortButton
                        sortKey="totalPromoPct"
                        currentSortKey={promoSortKey}
                        currentSortDir={promoSortDir}
                        onSort={() => handleSort(promoSortKey, promoSortDir, 'totalPromoPct', setPromoSortKey, setPromoSortDir)}
                      >
                        Total Promo %
                      </SortButton>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr className="bg-slate-100 font-semibold border-b-2 border-slate-300">
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatCurrency(promoTotals.relationshipDollars)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatCurrency(promoTotals.substandardDollars)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">-</td>
                  </tr>
                  {sortedPromos.map((promo, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{promo.locationName}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(promo.relationshipDollars)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(promo.substandardDollars)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{formatPercent(promo.totalPromoPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
