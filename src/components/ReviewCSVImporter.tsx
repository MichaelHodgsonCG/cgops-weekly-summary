import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

type ParsedReview = {
  source: string;
  restaurant_name: string;
  guest_name: string;
  review_date: string;
  visit_date: string | null;
  overall_rating: number | null;
  food_rating: number | null;
  service_rating: number | null;
  ambience_rating: number | null;
  value_rating: number | null;
  review_text: string | null;
  review_id: string;
  canonical_location: string | null;
};

type ImportResult = {
  inserted: number;
  duplicates: number;
  unmapped: string[];
  errors: string[];
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsvDate(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  // Format: "Apr 19, 2026 11:18 p.m." or "Apr 17, 2026 5:30 p.m."
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  // Try to extract just the date portion "Apr 19, 2026"
  const match = cleaned.match(/^([A-Za-z]+)\s+(\d+),\s+(\d{4})/);
  if (!match) return null;
  const date = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function parseRating(val: string): number | null {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

export default function ReviewCSVImporter() {
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<ParsedReview[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMappings = async (): Promise<Map<string, string>> => {
    const { data } = await supabase
      .from('location_mappings')
      .select('source_name, canonical_location_name');
    const map = new Map<string, string>();
    if (data) {
      for (const row of data) {
        map.set(row.source_name.toLowerCase().trim(), row.canonical_location_name);
      }
    }
    return map;
  };

  const processFile = useCallback(async (file: File) => {
    setParseError(null);
    setResult(null);
    setParsed(null);
    setFileName(file.name);

    const text = await file.text();
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) {
      setParseError('File appears to be empty or has no data rows.');
      return;
    }

    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const col = (name: string) => headers.indexOf(name);

    const sourceIdx = col('source');
    const restaurantIdx = col('restaurant name');
    const guestIdx = col('guest name');
    const reviewDateIdx = col('review date');
    const visitDateIdx = col('visit date');
    const overallIdx = col('overall rating');
    const foodIdx = col('food');
    const serviceIdx = col('service');
    const ambienceIdx = col('ambience');
    const valueIdx = col('value');
    const commentsIdx = col('review comments');
    const reviewIdIdx = col('review id');

    if (sourceIdx === -1 || restaurantIdx === -1 || overallIdx === -1) {
      setParseError('CSV does not appear to be a valid weekly reviews report. Expected columns: Source, Restaurant name, Overall rating.');
      return;
    }

    const mappings = await loadMappings();

    const rows: ParsedReview[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = parseCSVLine(line);
      const source = cols[sourceIdx]?.trim() ?? '';

      // Skip Google rows
      if (source.toLowerCase() === 'google') continue;

      const restaurantName = cols[restaurantIdx]?.trim() ?? '';
      const canonicalLocation = mappings.get(restaurantName.toLowerCase().trim()) ?? null;

      const reviewDateRaw = cols[reviewDateIdx]?.trim() ?? '';
      const visitDateRaw = visitDateIdx >= 0 ? cols[visitDateIdx]?.trim() ?? '' : '';
      const reviewDate = parseCsvDate(reviewDateRaw);

      if (!reviewDate) continue; // skip rows with no parseable date

      rows.push({
        source,
        restaurant_name: restaurantName,
        guest_name: cols[guestIdx]?.trim() ?? '',
        review_date: reviewDate,
        visit_date: parseCsvDate(visitDateRaw),
        overall_rating: overallIdx >= 0 ? parseRating(cols[overallIdx]?.trim() ?? '') : null,
        food_rating: foodIdx >= 0 ? parseRating(cols[foodIdx]?.trim() ?? '') : null,
        service_rating: serviceIdx >= 0 ? parseRating(cols[serviceIdx]?.trim() ?? '') : null,
        ambience_rating: ambienceIdx >= 0 ? parseRating(cols[ambienceIdx]?.trim() ?? '') : null,
        value_rating: valueIdx >= 0 ? parseRating(cols[valueIdx]?.trim() ?? '') : null,
        review_text: commentsIdx >= 0 ? (cols[commentsIdx]?.trim() || null) : null,
        review_id: reviewIdIdx >= 0 ? cols[reviewIdIdx]?.trim() ?? '' : '',
        canonical_location: canonicalLocation,
      });
    }

    if (rows.length === 0) {
      setParseError('No OpenTable review rows found in this file.');
      return;
    }

    setParsed(rows);
    setShowPreview(true);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) processFile(file);
  }, [processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!parsed) return;
    setLoading(true);

    const importResult: ImportResult = { inserted: 0, duplicates: 0, unmapped: [], errors: [] };
    const unmappedSet = new Set<string>();

    const toInsert = parsed
      .filter(r => {
        if (!r.canonical_location) {
          unmappedSet.add(r.restaurant_name);
          return false;
        }
        return true;
      })
      .map(r => ({
        location_name: r.canonical_location!,
        review_date: r.review_date,
        report_date: r.review_date,
        reviewer_name: r.guest_name || null,
        review_source: r.source,
        overall_rating: r.overall_rating,
        food_rating: r.food_rating,
        service_rating: r.service_rating,
        ambience_rating: r.ambience_rating,
        value_rating: r.value_rating,
        review_text: r.review_text,
        visit_date: r.visit_date ? new Date(r.visit_date).toISOString() : null,
      }));

    importResult.unmapped = Array.from(unmappedSet);

    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from('guest_feedback')
        .upsert(toInsert, {
          onConflict: 'location_name,reviewer_name,review_date,review_source',
          ignoreDuplicates: true,
        })
        .select('id');

      if (error) {
        importResult.errors.push(error.message);
      } else {
        importResult.inserted = data?.length ?? 0;
        importResult.duplicates = toInsert.length - importResult.inserted;
      }
    }

    setResult(importResult);
    setParsed(null);
    setLoading(false);
  };

  const handleReset = () => {
    setParsed(null);
    setResult(null);
    setParseError(null);
    setFileName('');
  };

  const unmappedInPreview = parsed ? [...new Set(parsed.filter(r => !r.canonical_location).map(r => r.restaurant_name))] : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Import Reviews from CSV</h2>
        <p className="text-sm text-slate-500 mt-1">
          Upload a weekly OpenTable/Google reviews CSV export. Google reviews are skipped automatically. Duplicate reviews are detected and skipped.
        </p>
      </div>

      {!parsed && !result && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors ${
            dragging ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center">
            <Upload className="w-7 h-7 text-slate-500" />
          </div>
          <div className="text-center">
            <p className="font-medium text-slate-700">Drop your CSV file here</p>
            <p className="text-sm text-slate-500 mt-1">or click to browse</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {parseError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Could not parse file</p>
            <p className="text-sm mt-1">{parseError}</p>
          </div>
          <button onClick={handleReset} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {parsed && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <FileText className="w-5 h-5" />
              <span className="font-medium">{fileName}</span>
              <span className="text-slate-400 text-sm">— {parsed.length} OpenTable {parsed.length === 1 ? 'review' : 'reviews'} found</span>
            </div>
            <button onClick={handleReset} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {unmappedInPreview.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Unrecognized restaurant names</p>
                <p className="text-sm mt-1">
                  The following will be skipped. Add them to Location Mappings to fix this:
                </p>
                <ul className="text-sm mt-1 list-disc list-inside">
                  {unmappedInPreview.map(n => <li key={n}>{n}</li>)}
                </ul>
              </div>
            </div>
          )}

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowPreview(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <span>Preview ({parsed.filter(r => r.canonical_location).length} rows will be imported)</span>
              {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showPreview && (
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {['Location', 'Guest', 'Review Date', 'Visit Date', 'Overall', 'Food', 'Service', 'Amb.', 'Value', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsed.map((r, i) => (
                      <tr key={i} className={r.canonical_location ? 'bg-white' : 'bg-amber-50'}>
                        <td className="px-3 py-2 text-slate-800 whitespace-nowrap">{r.canonical_location ?? r.restaurant_name}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.guest_name || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.review_date}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.visit_date ?? '—'}</td>
                        <td className="px-3 py-2 text-center font-medium text-slate-800">{r.overall_rating ?? '—'}</td>
                        <td className="px-3 py-2 text-center text-slate-600">{r.food_rating ?? '—'}</td>
                        <td className="px-3 py-2 text-center text-slate-600">{r.service_rating ?? '—'}</td>
                        <td className="px-3 py-2 text-center text-slate-600">{r.ambience_rating ?? '—'}</td>
                        <td className="px-3 py-2 text-center text-slate-600">{r.value_rating ?? '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.canonical_location
                            ? <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Ready</span>
                            : <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Skip</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={loading || parsed.filter(r => r.canonical_location).length === 0}
              className="px-5 py-2 text-sm font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Importing...' : `Import ${parsed.filter(r => r.canonical_location).length} Reviews`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Import Complete</h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{result.inserted}</p>
                <p className="text-sm text-green-600 mt-1">Imported</p>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <p className="text-2xl font-bold text-slate-600">{result.duplicates}</p>
                <p className="text-sm text-slate-500 mt-1">Duplicates skipped</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-amber-700">{result.unmapped.length}</p>
                <p className="text-sm text-amber-600 mt-1">Unmapped locations</p>
              </div>
            </div>

            {result.unmapped.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <p className="font-medium">Skipped (no location mapping):</p>
                <ul className="mt-1 list-disc list-inside">
                  {result.unmapped.map(n => <li key={n}>{n}</li>)}
                </ul>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <p className="font-medium">Errors:</p>
                <ul className="mt-1 list-disc list-inside">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>

          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}
