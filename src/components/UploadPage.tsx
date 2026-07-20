import { useState, useEffect, useMemo } from 'react';
import { Upload, AlertCircle, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { supabase, Location } from '../lib/supabase';
import { parseCSV, ParsedLineItem } from '../lib/csvParser';
import { parseExcel, WeekData } from '../lib/excelParser';
import { computeQtdForUpload } from '../lib/needToSave';
import { refreshSummaryPlFieldsForPeriod, computeSageTrueUpVariance, LocationTrueUp } from '../lib/summaryPlFields';

type ParseResult = {
  lineItems: ParsedLineItem[];
  errors: string[];
  locationName?: string;
  weekEndingDate?: string;
  weeks?: WeekData[];
};

// A file we've parsed (client-side only, nothing written yet) held in memory so
// the review table and the actual ingest use the exact same payload.
type ParsedFile = {
  file: File;
  fileName: string;
  result: ParseResult | null;
  parseError?: string;
};

// One row of the pre-ingest review table (a file may contribute several weeks).
type PreviewRow = {
  key: string;
  fileName: string;
  locationName: string;
  locationMatched: boolean;
  willCreate: boolean;
  weekEndingDate: string;
  foodSales: number | null;
  foodCost: number | null;
  foodCostPct: number | null;
  labour: number | null;
  labourPct: number | null;
  issues: string[];
};

// Food cost % this far outside a sane band almost always means a premature or
// mis-parsed P&L (e.g. Wildcraft's 53%). Highlighted, never blocked.
const FC_PCT_LOW = 10;
const FC_PCT_HIGH = 45;
const fcOutOfBand = (pct: number | null) => pct !== null && (pct < FC_PCT_LOW || pct > FC_PCT_HIGH);

export default function UploadPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [weekEndingDate, setWeekEndingDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ total: number; completed: number; current: string }>({ total: 0, completed: 0, current: '' });
  const [trueUps, setTrueUps] = useState<LocationTrueUp[]>([]);

  useEffect(() => {
    loadLocations();
    setWeekEndingDate(getMostRecentSunday());
  }, []);

  const loadLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name');

    if (!error && data) {
      setLocations(data);
    }
  };

  const getMostRecentSunday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? 0 : dayOfWeek;
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - diff);
    return sunday.toISOString().split('T')[0];
  };

  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  // Read-only match against locations already in memory. Used for the preview so
  // that reviewing files never creates anything.
  const matchLocation = (locationName?: string): Location | null => {
    if (!locationName) return null;
    const normalizedInput = normalizeText(locationName);
    return locations.find(loc => normalizeText(loc.name) === normalizedInput) || null;
  };

  const findOrCreateLocation = async (locationName: string): Promise<string | null> => {
    const matched = matchLocation(locationName);
    if (matched) return matched.id;

    const code = locationName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 10);

    const { data: newLocation, error } = await supabase
      .from('locations')
      .insert({ name: locationName, code })
      .select()
      .single();

    if (error) {
      console.error('Error creating location:', error);
      return null;
    }

    setLocations([...locations, newLocation]);
    return newLocation.id;
  };

  // Parse every selected file up front (no DB writes) so we can show a review of
  // exactly what will be ingested before anyone approves it.
  const processFiles = async (fileArray: File[]) => {
    setFiles(fileArray);
    setMessage(null);
    setTrueUps([]);
    setParsing(true);

    const parsed: ParsedFile[] = [];
    for (const file of fileArray) {
      try {
        let result: ParseResult;
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          result = await parseExcel(file);
        } else {
          const text = await file.text();
          result = parseCSV(text);
        }
        parsed.push({ file, fileName: file.name, result });
      } catch (e: any) {
        parsed.push({ file, fileName: file.name, result: null, parseError: e?.message || 'Could not read file' });
      }
    }
    setParsedFiles(parsed);

    // Auto-fill the top selectors from a single file (unchanged behaviour).
    if (fileArray.length === 1 && parsed[0]?.result) {
      const r = parsed[0].result;
      if (r.locationName) {
        const matched = matchLocation(r.locationName);
        if (matched) setSelectedLocation(matched.id);
      }
      if (r.weekEndingDate) setWeekEndingDate(r.weekEndingDate);
    }

    setParsing(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      const fileArray = Array.from(selectedFiles);
      await processFiles(fileArray);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const fileArray = Array.from(droppedFiles).filter(file =>
        file.name.endsWith('.csv') ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls')
      );

      if (fileArray.length > 0) {
        await processFiles(fileArray);
      } else {
        setMessage({ type: 'error', text: 'Please drop only CSV or Excel files' });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const clearSelection = () => {
    setFiles([]);
    setParsedFiles([]);
    setMessage(null);
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  // Derived review rows — recomputed from the parsed files plus the current
  // location/week selectors. Pure and synchronous: no DB access, no writes.
  const previewRows = useMemo<PreviewRow[]>(() => {
    const rows: PreviewRow[] = [];
    for (const pf of parsedFiles) {
      if (!pf.result) {
        rows.push({
          key: pf.fileName,
          fileName: pf.fileName,
          locationName: '—',
          locationMatched: false,
          willCreate: false,
          weekEndingDate: '—',
          foodSales: null,
          foodCost: null,
          foodCostPct: null,
          labour: null,
          labourPct: null,
          issues: [pf.parseError || 'Could not parse this file'],
        });
        continue;
      }

      const r = pf.result;
      const selected = selectedLocation ? locations.find(l => l.id === selectedLocation) || null : null;
      const matched = selected || matchLocation(r.locationName);
      const locationName = matched?.name || r.locationName || '(unresolved)';
      const willCreate = !matched && !!r.locationName;

      const weeks: WeekData[] = r.weeks && r.weeks.length > 0
        ? r.weeks
        : [{ weekEndingDate: r.weekEndingDate || weekEndingDate, lineItems: r.lineItems }];

      for (const wk of weeks) {
        const fs = wk.lineItems.find(li => li.line_item_name === 'Food Sales');
        const fc = wk.lineItems.find(li => li.line_item_name === 'Cost of Sales (Food)');
        const lab = wk.lineItems.find(li => li.line_item_name === 'Kitchen Labour');
        const foodCostPct = fc?.current_actual_pct ?? null;

        const issues: string[] = [];
        if (r.errors && r.errors.length > 0) issues.push(...r.errors);
        if (!matched && !r.locationName) issues.push('Location not determined — pick one above');
        if (!wk.weekEndingDate) issues.push('No week ending date');
        if (!fs) issues.push('Missing Food Sales line');
        if (!fc) issues.push('Missing Cost of Sales (Food) line');
        if (fcOutOfBand(foodCostPct)) issues.push(`Food cost ${foodCostPct?.toFixed(1)}% looks unusual — verify the source`);

        rows.push({
          key: `${pf.fileName}|${wk.weekEndingDate}`,
          fileName: pf.fileName,
          locationName,
          locationMatched: !!matched,
          willCreate,
          weekEndingDate: wk.weekEndingDate || '—',
          foodSales: fs?.current_actual ?? null,
          foodCost: fc?.current_actual ?? null,
          foodCostPct,
          labour: lab?.current_actual ?? null,
          labourPct: lab?.current_actual_pct ?? null,
          issues,
        });
      }
    }
    return rows;
  }, [parsedFiles, locations, selectedLocation, weekEndingDate]);

  const flaggedCount = previewRows.filter(r => r.issues.length > 0).length;

  const handleUpload = async () => {
    if (parsedFiles.length === 0 || !weekEndingDate) {
      setMessage({ type: 'error', text: 'Please select at least one file and a week ending date' });
      return;
    }

    setUploading(true);
    setMessage(null);
    setUploadProgress({ total: parsedFiles.length, completed: 0, current: '' });

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    // (location, fiscal year, period) combinations whose P&L changed, so we can
    // refresh the stored P&L-driven fields on their saved summaries afterwards.
    const affectedPeriods = new Set<string>();
    // Individual (location, week) uploads, so we can true up each week's chef
    // estimate against the reconciled Sage numbers we just loaded.
    const affectedWeeks = new Map<string, { locationId: string; locationName: string; fiscalYear: number; period: number; weekEndingDate: string }>();

    setTrueUps([]);

    try {
      // Ingest the payloads we already parsed for the review — no re-parsing, so
      // what was approved is exactly what gets written.
      for (let i = 0; i < parsedFiles.length; i++) {
        const pf = parsedFiles[i];
        const file = pf.file;
        setUploadProgress({ total: parsedFiles.length, completed: i, current: file.name });

        try {
          const result = pf.result;

          if (!result) {
            results.failed++;
            results.errors.push(`${file.name}: ${pf.parseError || 'Could not parse file'}`);
            continue;
          }

          if (result.errors.length > 0) {
            results.failed++;
            results.errors.push(`${file.name}: ${result.errors.join(', ')}`);
            continue;
          }

          let locationId = selectedLocation;

          if (!locationId && result.locationName) {
            locationId = await findOrCreateLocation(result.locationName) || '';
          }

          if (!locationId) {
            results.failed++;
            results.errors.push(`${file.name}: Could not determine location`);
            continue;
          }

          const weeksToProcess: WeekData[] = result.weeks && result.weeks.length > 0
            ? result.weeks
            : [{ weekEndingDate: result.weekEndingDate || weekEndingDate, lineItems: result.lineItems }];

          for (const week of weeksToProcess) {
            const { data: existingUpload } = await supabase
              .from('weekly_summary_pl_uploads')
              .select('id')
              .eq('location_id', locationId)
              .eq('week_ending_date', week.weekEndingDate)
              .maybeSingle();

            if (existingUpload) {
              await supabase
                .from('weekly_summary_pl_line_items')
                .delete()
                .eq('upload_id', existingUpload.id);

              await supabase
                .from('weekly_summary_pl_uploads')
                .delete()
                .eq('id', existingUpload.id);
            }

            const { data: upload, error: uploadError } = await supabase
              .from('weekly_summary_pl_uploads')
              .insert({
                location_id: locationId,
                week_ending_date: week.weekEndingDate,
                filename: file.name,
                status: 'completed'
              })
              .select()
              .single();

            if (uploadError) {
              results.failed++;
              results.errors.push(`${file.name} (Week ${week.weekEndingDate}): ${uploadError.message}`);
              continue;
            }

            const { data: calWeek } = await supabase
              .from('fiscal_calendar')
              .select('fiscal_year, period')
              .lte('start_date', week.weekEndingDate)
              .gte('end_date', week.weekEndingDate)
              .maybeSingle();

            let qtdMap: Map<string, { qtd_actual: number | null; qtd_actual_pct: number | null; qtd_budget: number | null; qtd_budget_pct: number | null }> | null = null;

            if (calWeek) {
              qtdMap = await computeQtdForUpload(
                locationId,
                calWeek.fiscal_year,
                calWeek.period,
                week.weekEndingDate,
                week.lineItems
              );
            }

            const lineItemsToInsert = week.lineItems.map(item => {
              const qtd = qtdMap?.get(item.line_item_name);
              return {
                upload_id: upload.id,
                location_id: locationId,
                week_ending_date: week.weekEndingDate,
                ...item,
                ...(qtd ?? {})
              };
            });

            const { error: itemsError } = await supabase
              .from('weekly_summary_pl_line_items')
              .insert(lineItemsToInsert);

            if (itemsError) {
              results.failed++;
              results.errors.push(`${file.name} (Week ${week.weekEndingDate}): ${itemsError.message}`);
            } else if (calWeek) {
              affectedPeriods.add(`${locationId}|${calWeek.fiscal_year}|${calWeek.period}`);
              const resolvedName = locations.find((l) => l.id === locationId)?.name || result.locationName || 'Location';
              affectedWeeks.set(`${locationId}|${week.weekEndingDate}`, {
                locationId,
                locationName: resolvedName,
                fiscalYear: calWeek.fiscal_year,
                period: calWeek.period,
                weekEndingDate: week.weekEndingDate,
              });
            }
          }

          results.successful++;

        } catch (fileError: any) {
          results.failed++;
          results.errors.push(`${file.name}: ${fileError.message || 'Unknown error'}`);
        }
      }

      // Refresh stored P&L-driven fields (period budget, QTD, PTD costs) on any
      // saved summaries for the periods we just uploaded P&L for, so reports and
      // dashboards reflect the new P&L without the chef re-saving. Best-effort.
      if (affectedPeriods.size > 0) {
        setUploadProgress({ total: parsedFiles.length, completed: parsedFiles.length, current: 'Updating summaries...' });
        for (const key of affectedPeriods) {
          const [locId, fyStr, periodStr] = key.split('|');
          try {
            await refreshSummaryPlFieldsForPeriod(locId, Number(fyStr), Number(periodStr));
          } catch (e) {
            console.error('Failed to refresh summary P&L fields for', key, e);
          }
        }
      }

      // True up each uploaded week's chef estimate against the reconciled Sage
      // numbers, for the per-location variance panel. Best-effort.
      if (affectedWeeks.size > 0) {
        setUploadProgress({ total: parsedFiles.length, completed: parsedFiles.length, current: 'Building variance report...' });
        const variances: LocationTrueUp[] = [];
        for (const w of affectedWeeks.values()) {
          try {
            const v = await computeSageTrueUpVariance(w.locationId, w.locationName, w.fiscalYear, w.period, w.weekEndingDate);
            if (v) variances.push(v);
          } catch (e) {
            console.error('Failed to compute true-up variance for', w, e);
          }
        }
        variances.sort((a, b) => a.locationName.localeCompare(b.locationName));
        setTrueUps(variances);
      }

      setUploadProgress({ total: parsedFiles.length, completed: parsedFiles.length, current: '' });

      if (results.successful > 0 && results.failed === 0) {
        setMessage({
          type: 'success',
          text: `Successfully uploaded ${results.successful} file${results.successful !== 1 ? 's' : ''}`
        });
      } else if (results.successful > 0 && results.failed > 0) {
        setMessage({
          type: 'error',
          text: `Uploaded ${results.successful} file(s), ${results.failed} failed: ${results.errors.join('; ')}`
        });
      } else {
        setMessage({
          type: 'error',
          text: `All uploads failed: ${results.errors.join('; ')}`
        });
      }

      setFiles([]);
      setParsedFiles([]);
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Upload error:', error);
      setMessage({ type: 'error', text: 'Failed to upload data. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const hasReview = parsedFiles.length > 0 && !uploading;

  return (
    <div className="min-h-screen bg-cg-bg p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-cg-surface rounded-xl shadow-cg border border-cg-border overflow-hidden max-w-2xl mx-auto w-full">
          <div className="bg-cg-surface px-6 py-4 border-b border-cg-border">
            <h1 className="text-2xl font-semibold text-cg-text flex items-center gap-2">
              <Upload className="w-6 h-6 text-cg-accent" />
              Upload P&L Data
            </h1>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Week Ending Date (Sunday)
              </label>
              <input
                type="date"
                value={weekEndingDate}
                onChange={(e) => setWeekEndingDate(e.target.value)}
                className="w-full px-4 py-2 border border-cg-border rounded-lg text-cg-text focus:outline-none focus:ring-2 focus:ring-cg-accent/40 focus:border-cg-accent"
              />
              <p className="text-xs text-slate-500 mt-1">
                Used only for files that don't carry their own week ending date.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                P&L Files (CSV or Excel) - Select Multiple
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-cg-borderStrong rounded-lg p-8 text-center hover:border-cg-accent transition-colors"
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  multiple
                  className="hidden"
                />
                <label
                  htmlFor="file-input"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="w-12 h-12 text-slate-400" />
                  <span className="text-sm text-slate-600 font-medium">
                    {files.length > 0 ? `${files.length} file${files.length !== 1 ? 's' : ''} selected` : 'Click to browse or drag & drop files here'}
                  </span>
                  <span className="text-xs text-slate-500">
                    Select multiple files (Ctrl+Click or Cmd+Click) - supports .csv, .xlsx, and .xls
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    Or drag all 16 files here at once
                  </span>
                </label>
              </div>
            </div>

            {parsing && (
              <div className="bg-cg-accentSoft rounded-lg p-4 border border-cg-accent/20 text-sm text-cg-accentHover flex items-center gap-2">
                <Upload className="w-4 h-4 animate-pulse" />
                Reading {files.length} file{files.length !== 1 ? 's' : ''}…
              </div>
            )}

            {uploading && uploadProgress.total > 0 && (
              <div className="bg-cg-accentSoft rounded-lg p-4 border border-cg-accent/20">
                <div className="flex justify-between text-sm text-cg-text mb-2">
                  <span>Ingesting files...</span>
                  <span className="tabular-nums">{uploadProgress.completed} / {uploadProgress.total}</span>
                </div>
                <div className="w-full bg-cg-surface3 rounded-full h-2 mb-2">
                  <div
                    className="bg-cg-accent h-2 rounded-full transition-all"
                    style={{ width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` }}
                  ></div>
                </div>
                {uploadProgress.current && (
                  <p className="text-xs text-cg-muted">
                    Processing: {uploadProgress.current}
                  </p>
                )}
              </div>
            )}

            {message && (
              <div
                className={`rounded-lg p-4 flex items-start gap-3 ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="text-sm">{message.text}</span>
              </div>
            )}
          </div>
        </div>

        {hasReview && (
          <IngestReviewCard
            rows={previewRows}
            fileCount={parsedFiles.length}
            flaggedCount={flaggedCount}
            weekEndingDate={weekEndingDate}
            onApprove={handleUpload}
            onCancel={clearSelection}
          />
        )}

        {trueUps.length > 0 && <TrueUpVariancePanel trueUps={trueUps} />}
      </div>
    </div>
  );
}

function IngestReviewCard({
  rows,
  fileCount,
  flaggedCount,
  weekEndingDate,
  onApprove,
  onCancel,
}: {
  rows: PreviewRow[];
  fileCount: number;
  flaggedCount: number;
  weekEndingDate: string;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const money = (v: number | null) =>
    v === null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`;
  const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)}%`);

  return (
    <div className="bg-cg-surface rounded-xl shadow-cg border border-cg-border overflow-hidden">
      <div className="bg-cg-surface2 px-6 py-4 border-b border-cg-border flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-cg-text">Review before ingesting</h2>
          <p className="text-xs text-cg-muted mt-1">
            {rows.length} row{rows.length !== 1 ? 's' : ''} from {fileCount} file{fileCount !== 1 ? 's' : ''} ·{' '}
            {flaggedCount > 0 ? (
              <span className="text-amber-600 font-medium">{flaggedCount} flagged — double-check below</span>
            ) : (
              <span className="text-green-600 font-medium">nothing flagged</span>
            )}
            . Nothing is written until you approve.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-cg-surface">
            <tr className="text-cg-faint">
              <th className="px-4 py-2 text-left font-medium">Location</th>
              <th className="px-4 py-2 text-left font-medium">Week Ending</th>
              <th className="px-4 py-2 text-right font-medium">Food Sales</th>
              <th className="px-4 py-2 text-right font-medium">Cost of Sales</th>
              <th className="px-4 py-2 text-right font-medium">FC %</th>
              <th className="px-4 py-2 text-right font-medium">Kitchen Labour</th>
              <th className="px-4 py-2 text-right font-medium">Lab %</th>
              <th className="px-4 py-2 text-left font-medium">File</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const flagged = r.issues.length > 0;
              const fcBad = fcOutOfBand(r.foodCostPct);
              return (
                <tr key={r.key} className={`border-t border-cg-border ${flagged ? 'bg-amber-50' : ''}`}>
                  <td className="px-4 py-2 text-cg-text font-medium whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      {flagged && <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                      {r.locationName}
                      {r.willCreate && (
                        <span className="ml-1 text-[10px] uppercase tracking-wide bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">new</span>
                      )}
                    </span>
                    {flagged && (
                      <span className="block text-xs text-amber-700 mt-0.5">{r.issues.join(' · ')}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-cg-muted whitespace-nowrap">{r.weekEndingDate}</td>
                  <td className="px-4 py-2 text-right text-cg-text tabular-nums">{money(r.foodSales)}</td>
                  <td className="px-4 py-2 text-right text-cg-text tabular-nums">{money(r.foodCost)}</td>
                  <td className={`px-4 py-2 text-right font-semibold tabular-nums ${fcBad ? 'text-amber-700' : 'text-cg-text'}`}>
                    {pct(r.foodCostPct)}
                  </td>
                  <td className="px-4 py-2 text-right text-cg-text tabular-nums">{money(r.labour)}</td>
                  <td className="px-4 py-2 text-right text-cg-muted tabular-nums">{pct(r.labourPct)}</td>
                  <td className="px-4 py-2 text-left text-cg-faint text-xs truncate max-w-[180px]" title={r.fileName}>{r.fileName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-cg-border flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 text-cg-muted hover:bg-cg-surface2 hover:text-cg-text rounded-lg text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          onClick={onApprove}
          disabled={!weekEndingDate}
          className="bg-cg-accent text-white px-6 py-2 rounded-lg font-medium hover:bg-cg-accentHover disabled:bg-cg-surface3 disabled:text-cg-faint disabled:cursor-not-allowed transition-colors"
        >
          Approve &amp; Ingest {fileCount} File{fileCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}

function TrueUpVariancePanel({ trueUps }: { trueUps: LocationTrueUp[] }) {
  const money = (v: number) =>
    `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(2)}%`);

  return (
    <div className="mt-6 bg-cg-surface rounded-xl shadow-cg border border-cg-border overflow-hidden">
      <div className="bg-cg-surface2 px-6 py-4 border-b border-cg-border">
        <h2 className="text-lg font-semibold text-cg-text">Estimate vs Sage — True-Up Variance</h2>
        <p className="text-xs text-cg-muted mt-1">
          How each location's chef estimate compared to the reconciled Sage numbers you just uploaded.
          Variance = estimate − Sage; a positive COGs/Labour variance means the estimate ran higher than actual.
        </p>
      </div>
      <div className="p-6 space-y-6">
        {trueUps.map((t) => (
          <div key={`${t.locationId}-${t.weekEndingDate}`} className="border border-cg-border rounded-lg overflow-hidden">
            <div className="bg-cg-surface2 px-4 py-2 border-b border-cg-border flex items-center justify-between">
              <span className="text-sm font-semibold text-cg-text">{t.locationName}</span>
              <span className="text-xs text-cg-muted">P{t.period} W{t.weekNumber} · WE {t.weekEndingDate}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cg-surface">
                  <tr className="text-cg-faint">
                    <th className="px-4 py-2 text-left font-medium"></th>
                    <th className="px-4 py-2 text-right font-medium">Estimate</th>
                    <th className="px-4 py-2 text-right font-medium">Sage</th>
                    <th className="px-4 py-2 text-right font-medium">Variance</th>
                    <th className="px-4 py-2 text-right font-medium">Est %</th>
                    <th className="px-4 py-2 text-right font-medium">Sage %</th>
                  </tr>
                </thead>
                <tbody>
                  {t.lines.map((l) => (
                    <tr key={l.metric} className="border-t border-cg-border">
                      <td className="px-4 py-2 text-cg-text font-medium">
                        {l.metric}
                        {l.metric === 'Sales' && t.salesIsPushBasis && (
                          <span className="ml-1 text-xs text-amber-600" title="Estimate is Push POS sales; Sage is the Food Sales line — different source systems.">
                            (Push vs Sage)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-cg-text tabular-nums">{money(l.estimate)}</td>
                      <td className="px-4 py-2 text-right text-cg-text tabular-nums">{money(l.sage)}</td>
                      <td className={`px-4 py-2 text-right font-semibold tabular-nums ${Math.abs(l.variance) < 1 ? 'text-cg-faint' : l.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {l.variance > 0 ? '+' : ''}{money(l.variance)}
                      </td>
                      <td className="px-4 py-2 text-right text-cg-muted tabular-nums">{pct(l.estimatePct)}</td>
                      <td className="px-4 py-2 text-right text-cg-muted tabular-nums">{pct(l.sagePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
