import { useState, useEffect } from 'react';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase, Location } from '../lib/supabase';
import { parseCSV, ParsedLineItem } from '../lib/csvParser';
import { parseExcel, WeekData } from '../lib/excelParser';
import { computeQtdForUpload } from '../lib/needToSave';

export default function UploadPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [weekEndingDate, setWeekEndingDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ total: number; completed: number; current: string }>({ total: 0, completed: 0, current: '' });

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

  const findOrCreateLocation = async (locationName: string): Promise<string | null> => {
    const normalizedInput = normalizeText(locationName);

    let matchedLocation = locations.find(
      loc => normalizeText(loc.name) === normalizedInput
    );

    if (matchedLocation) {
      return matchedLocation.id;
    }

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

  const processFiles = async (fileArray: File[]) => {
    setFiles(fileArray);
    setMessage(null);

    if (fileArray.length === 1) {
      const selectedFile = fileArray[0];
      let result: { lineItems: ParsedLineItem[]; errors: string[]; locationName?: string; weekEndingDate?: string };

      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        result = await parseExcel(selectedFile);
      } else {
        const text = await selectedFile.text();
        result = parseCSV(text);
      }

      if (result.locationName) {
        const locationId = await findOrCreateLocation(result.locationName);
        if (locationId) {
          setSelectedLocation(locationId);
        }
      }

      if (result.weekEndingDate) {
        setWeekEndingDate(result.weekEndingDate);
      }

      if (result.errors.length > 0) {
        setMessage({ type: 'error', text: result.errors.join(', ') });
      }
    }
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

  const handleUpload = async () => {
    if (files.length === 0 || !weekEndingDate) {
      setMessage({ type: 'error', text: 'Please select at least one file and a week ending date' });
      return;
    }

    setUploading(true);
    setMessage(null);
    setUploadProgress({ total: files.length, completed: 0, current: '' });

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ total: files.length, completed: i, current: file.name });

        try {
          let result: { lineItems: ParsedLineItem[]; errors: string[]; locationName?: string; weekEndingDate?: string; weeks?: WeekData[] };

          if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            result = await parseExcel(file);
          } else {
            const text = await file.text();
            result = parseCSV(text);
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
              .from('pl_uploads')
              .select('id')
              .eq('location_id', locationId)
              .eq('week_ending_date', week.weekEndingDate)
              .maybeSingle();

            if (existingUpload) {
              await supabase
                .from('pl_line_items')
                .delete()
                .eq('upload_id', existingUpload.id);

              await supabase
                .from('pl_uploads')
                .delete()
                .eq('id', existingUpload.id);
            }

            const { data: upload, error: uploadError } = await supabase
              .from('pl_uploads')
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
              .from('pl_line_items')
              .insert(lineItemsToInsert);

            if (itemsError) {
              results.failed++;
              results.errors.push(`${file.name} (Week ${week.weekEndingDate}): ${itemsError.message}`);
            }
          }

          results.successful++;

        } catch (fileError: any) {
          results.failed++;
          results.errors.push(`${file.name}: ${fileError.message || 'Unknown error'}`);
        }
      }

      setUploadProgress({ total: files.length, completed: files.length, current: '' });

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
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Upload error:', error);
      setMessage({ type: 'error', text: 'Failed to upload data. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
              <Upload className="w-6 h-6" />
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
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                P&L Files (CSV or Excel) - Select Multiple
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors"
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

            {files.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                <h3 className="text-sm font-medium text-slate-700 mb-2">
                  Selected Files ({files.length}):
                </h3>
                <ul className="space-y-1">
                  {files.map((file, index) => (
                    <li key={index} className="text-sm text-slate-600 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      {file.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {uploading && uploadProgress.total > 0 && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex justify-between text-sm text-blue-900 mb-2">
                  <span>Uploading files...</span>
                  <span>{uploadProgress.completed} / {uploadProgress.total}</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` }}
                  ></div>
                </div>
                {uploadProgress.current && (
                  <p className="text-xs text-blue-700">
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

            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0 || !weekEndingDate}
              className="w-full bg-slate-800 text-white py-3 rounded-lg font-medium hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? `Uploading ${uploadProgress.completed}/${uploadProgress.total}...` : `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
