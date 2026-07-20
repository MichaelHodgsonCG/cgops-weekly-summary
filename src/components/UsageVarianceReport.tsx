import { useEffect, useMemo, useState } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

// HQ report: the variance reasons chefs record during the Guided Workflow's
// Usage Review (over/under-used products). Pick a location, one or more weeks,
// run — grouped by Inv Date (the week-ending inventory date), showing each
// flagged item, its variance, and the reason the chef entered.
//
// Source: weekly_summary_chef_summary.usage_review_items — a JSON-encoded text
// blob of the shape below, written by GuidedUsageReviewStep. Inv Date comes from
// fiscal_calendar (chef_summary period_number/week_number -> fiscal_calendar
// period/week for the same fiscal_year).

interface FlaggedItem {
  itemName: string;
  direction: 'under' | 'over';
  weekVariance: number;
  comment: string;
}

interface LocationRow { id: string; name: string; }

interface WeekRow {
  fiscal_year: number;
  period_number: number;
  week_number: number;
  items: FlaggedItem[];
  invDate: string; // resolved from fiscal_calendar (end_date)
}

const weekKey = (fy: number, p: number, w: number) => `${fy}-${p}-${w}`;

function parseItems(raw: string | null): FlaggedItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<FlaggedItem>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i) => i && typeof i.itemName === 'string' && i.itemName.trim() !== '')
      .map((i) => ({
        itemName: i.itemName as string,
        direction: i.direction === 'over' ? 'over' : 'under',
        weekVariance: typeof i.weekVariance === 'number' ? i.weekVariance : 0,
        comment: (i.comment ?? '').toString(),
      }));
  } catch {
    return [];
  }
}

const fmtVariance = (v: number) =>
  `${v > 0 ? '+' : v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function UsageVarianceReport() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState('');
  const [invDateByWeek, setInvDateByWeek] = useState<Map<string, string>>(new Map());
  const [weeks, setWeeks] = useState<WeekRow[]>([]);       // weeks with usage data for the location
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<WeekRow[] | null>(null);
  const [loadingWeeks, setLoadingWeeks] = useState(false);

  // Locations + fiscal calendar (Inv Date map) once.
  useEffect(() => {
    (async () => {
      const [{ data: locs }, { data: cal }] = await Promise.all([
        supabase.from('locations').select('id, name').eq('exclude_from_reporting', false).order('name'),
        supabase.from('fiscal_calendar').select('fiscal_year, period, week, end_date'),
      ]);
      setLocations((locs ?? []) as LocationRow[]);
      const map = new Map<string, string>();
      (cal ?? []).forEach((c: { fiscal_year: number; period: number; week: number; end_date: string }) =>
        map.set(weekKey(c.fiscal_year, c.period, c.week), c.end_date)
      );
      setInvDateByWeek(map);
    })();
  }, []);

  // Weeks that actually have usage-review data for the chosen location.
  useEffect(() => {
    setWeeks([]);
    setSelected(new Set());
    setReport(null);
    if (!locationId) return;
    setLoadingWeeks(true);
    (async () => {
      const { data } = await supabase
        .from('weekly_summary_chef_summary')
        .select('fiscal_year, period_number, week_number, usage_review_items')
        .eq('location_id', locationId);
      const rows: WeekRow[] = (data ?? [])
        .map((r: { fiscal_year: number; period_number: number; week_number: number; usage_review_items: string | null }) => ({
          fiscal_year: r.fiscal_year,
          period_number: r.period_number,
          week_number: r.week_number,
          items: parseItems(r.usage_review_items),
          invDate: invDateByWeek.get(weekKey(r.fiscal_year, r.period_number, r.week_number)) ?? '',
        }))
        .filter((r) => r.items.length > 0)
        .sort((a, b) => (b.invDate || '').localeCompare(a.invDate || ''));
      setWeeks(rows);
      setLoadingWeeks(false);
    })();
  }, [locationId, invDateByWeek]);

  const toggleWeek = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const allSelected = weeks.length > 0 && weeks.every((w) => selected.has(weekKey(w.fiscal_year, w.period_number, w.week_number)));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(weeks.map((w) => weekKey(w.fiscal_year, w.period_number, w.week_number))));

  const run = () =>
    setReport(weeks.filter((w) => selected.has(weekKey(w.fiscal_year, w.period_number, w.week_number))));

  const locationName = useMemo(() => locations.find((l) => l.id === locationId)?.name ?? '', [locations, locationId]);

  const exportCsv = () => {
    if (!report) return;
    const rows: string[] = ['Inv Date,Period,Week,Item,Direction,Variance,Reason'];
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    report.forEach((w) =>
      w.items.forEach((it) =>
        rows.push([
          w.invDate, `P${w.period_number}`, `W${w.week_number}`,
          esc(it.itemName), it.direction, it.weekVariance.toFixed(2), esc(it.comment),
        ].join(','))
      )
    );
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `variance-reasons_${locationName.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-slate-700" />
        <div>
          <h2 className="text-xl font-bold text-slate-900">Usage Variance Reasons</h2>
          <p className="text-sm text-slate-500">Over/under-used product variances and the reasons chefs recorded, by inventory date.</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full md:w-96 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cg-accent/40 bg-white"
          >
            <option value="">Select a location…</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        {locationId && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">Week(s) — inventory date</label>
              {weeks.length > 0 && (
                <button onClick={toggleAll} className="text-xs font-medium text-slate-600 hover:text-slate-900">
                  {allSelected ? 'Clear all' : 'Select all'}
                </button>
              )}
            </div>
            {loadingWeeks ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading weeks…</div>
            ) : weeks.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">No recorded usage-review reasons for this location yet.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {weeks.map((w) => {
                  const key = weekKey(w.fiscal_year, w.period_number, w.week_number);
                  return (
                    <label key={key} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">
                      <input type="checkbox" checked={selected.has(key)} onChange={() => toggleWeek(key)} className="rounded border-slate-300" />
                      <span className="font-medium text-slate-800">{w.invDate || '(no date)'}</span>
                      <span className="text-slate-500">P{w.period_number} W{w.week_number}</span>
                      <span className="ml-auto text-xs text-slate-400">{w.items.length} item{w.items.length === 1 ? '' : 's'}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={run}
            disabled={selected.size === 0}
            className="px-4 py-2 bg-cg-accent text-white rounded-lg font-medium text-sm hover:bg-cg-accentHover transition-colors disabled:opacity-50"
          >
            Run report
          </button>
          {report && report.length > 0 && (
            <button onClick={exportCsv} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Report */}
      {report && (
        <div className="space-y-6">
          {report.length === 0 && <p className="text-sm text-slate-500">No weeks selected.</p>}
          {report.map((w) => (
            <div key={weekKey(w.fiscal_year, w.period_number, w.week_number)} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-baseline gap-3">
                <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Inv Date</span>
                <span className="text-base font-bold text-slate-900">{w.invDate || '(no date)'}</span>
                <span className="text-sm text-slate-500">{locationName} · P{w.period_number} W{w.week_number}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100">
                      <th className="px-4 py-2 font-medium">Item</th>
                      <th className="px-4 py-2 font-medium">Variance</th>
                      <th className="px-4 py-2 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {w.items.map((it, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0 align-top">
                        <td className="px-4 py-2 font-medium text-slate-800">
                          {it.itemName}
                          <span className={`ml-2 text-xs font-normal ${it.direction === 'over' ? 'text-red-600' : 'text-amber-600'}`}>
                            {it.direction === 'over' ? 'over' : 'under'}
                          </span>
                        </td>
                        <td className={`px-4 py-2 whitespace-nowrap font-medium ${it.weekVariance > 0 ? 'text-red-700' : 'text-slate-700'}`}>
                          {fmtVariance(it.weekVariance)}
                        </td>
                        <td className="px-4 py-2 text-slate-700">{it.comment.trim() || <span className="text-slate-400">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default UsageVarianceReport;
