import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { parseChefSummaryCSV } from '../lib/chefSummaryParser';

async function readFileAsCsvText(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return file.text();
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_csv(firstSheet);
}

export function ChefSummaryImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const text = await readFileAsCsvText(file);
      const parsedData = parseChefSummaryCSV(text);

      const { data: location, error: locationError } = await supabase
        .from('locations')
        .select('id, code')
        .or(`code.eq.${parsedData.location_code},name.eq.${parsedData.location_code}`)
        .maybeSingle();

      if (locationError || !location) {
        setMessage({
          type: 'error',
          text: `Location not found for code: ${parsedData.location_code}`
        });
        setUploading(false);
        return;
      }

      const summaryData = {
        location_id: location.id,
        week_number: parsedData.week_number,
        period_number: parsedData.period_number,
        fiscal_year: 2026,

        budget_food_cost_pct: parsedData.budget_food_cost_pct,
        actual_food_cost_pct: parsedData.actual_food_cost_pct,
        fc_variance: parsedData.fc_variance,
        theoretical_food_cost_pct: parsedData.theoretical_food_cost_pct,
        on_hand_amount: parsedData.on_hand_amount,
        theoretical_variance: parsedData.theoretical_variance,

        sage_food_sales_qtd: parsedData.sage_food_sales_qtd,
        sage_fcost_qtd_pct: parsedData.sage_fcost_qtd_pct,
        food_cost_ptd_pct: parsedData.food_cost_ptd_pct,
        sage_sales_budget_qtd: parsedData.sage_sales_budget_qtd,
        fc_qtd_pct: parsedData.fc_qtd_pct,
        qtd_variance_pct: parsedData.qtd_variance_pct,
        usage_amount: parsedData.usage_amount,
        ideal_usage_amount: parsedData.ideal_usage_amount,
        cogs_qtd: parsedData.cogs_qtd,
        food_sales_labour_push: parsedData.food_sales_labour_push,
        food_sales_oc: parsedData.food_sales_oc,
        week_variance_amount: parsedData.week_variance_amount,
        budget_food_sales_period: parsedData.budget_food_sales_period,
        week_budget: parsedData.week_budget,
        qtd_variance_amount: parsedData.qtd_variance_amount,

        labour_budget_pct: parsedData.labour_budget_pct,
        labour_cost_pct: parsedData.labour_cost_pct,
        lc_variance: parsedData.lc_variance,
        sage_labour_budget_qtd_pct: parsedData.sage_labour_budget_qtd_pct,
        sage_lcost_qtd_pct: parsedData.sage_lcost_qtd_pct,
        labour_cost_ptd_pct: parsedData.labour_cost_ptd_pct,
        labour_qtd_pct: parsedData.labour_qtd_pct,
        lab_ptd_var_amount: parsedData.lab_ptd_var_amount,
        qtd_labour_variance_pct: parsedData.qtd_labour_variance_pct,
        labour_spent: parsedData.labour_spent,
        overtime_amount: parsedData.overtime_amount,
        lab_qtd_var_amount: parsedData.lab_qtd_var_amount,

        ebidta_budget_period_pct: parsedData.ebidta_budget_period_pct,
        ebidta_ptd_pct: parsedData.ebidta_ptd_pct,
        ebidta_variance_pct: parsedData.ebidta_variance_pct,
        qsr_weekend_lunch_time: parsedData.qsr_weekend_lunch_time,
        qsr_expo_time: parsedData.qsr_expo_time,
        teamshare_amount: parsedData.teamshare_amount,

        petty_cash: parsedData.petty_cash,
        waste_amount: parsedData.waste_amount,
        last_audit_score_pct: parsedData.last_audit_score_pct,
        boh_promo_amount: parsedData.boh_promo_amount,
        promo_ptd: parsedData.promo_ptd,
        promo_qtd: parsedData.promo_qtd,
        weeks_remaining_in_qtr: parsedData.weeks_remaining_in_qtr,
        sous_vac_days: parsedData.sous_vac_days,
        fc_need_save_per_week: parsedData.fc_need_save_per_week,
        fc_need_save_per_day: parsedData.fc_need_save_per_day,
        labour_need_save_per_week: parsedData.labour_need_save_per_week,
        labour_need_save_per_day: parsedData.labour_need_save_per_day,

        food_cost_summary: parsedData.food_cost_summary,
        labour_summary: parsedData.labour_summary,
        boh_promo_summary: parsedData.boh_promo_summary,
        notes: parsedData.notes,
        action_plan_summary: parsedData.action_plan_summary,
        rm_issues_cleaning_focus: parsedData.rm_issues_cleaning_focus,

        ideal_cooks: parsedData.ideal_cooks,
        current_cooks: parsedData.current_cooks,
        ideal_prep: parsedData.ideal_prep,
        current_prep: parsedData.current_prep,
        ideal_dish: parsedData.ideal_dish,
        current_dish: parsedData.current_dish,
        ideal_other: parsedData.ideal_other,
        current_other: parsedData.current_other,
        hiring_notes: parsedData.hiring_notes,
        tm_mots_of_note: parsedData.tm_mots_of_note,
        development_path_updates: parsedData.development_path_updates,

        feature_items: parsedData.feature_items,
        hires: parsedData.hires,
        terminated: parsedData.terminated,

        updated_at: new Date().toISOString()
      };

      const { error: upsertError } = await supabase
        .from('weekly_chef_summary')
        .upsert(summaryData, {
          onConflict: 'location_id,fiscal_year,period_number,week_number'
        });

      if (upsertError) {
        setMessage({ type: 'error', text: `Upload failed: ${upsertError.message}` });
      } else {
        setMessage({
          type: 'success',
          text: `Successfully imported summary for ${location.code} - Period ${parsedData.period_number}, Week ${parsedData.week_number}`
        });
        setFile(null);
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setMessage({
        type: 'error',
        text: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
          <Upload className="w-5 h-5 text-slate-700" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Import Chef Summary</h2>
          <p className="text-sm text-slate-600">Upload a CSV or Excel file from the weekly chef summary report</p>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg p-4 mb-4 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border-2 border-green-200'
              : 'bg-red-50 text-red-800 border-2 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="chef-summary-file"
            disabled={uploading}
          />
          <label
            htmlFor="chef-summary-file"
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            <FileText className="w-12 h-12 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">
              {file ? file.name : 'Click to select CSV or Excel file'}
            </span>
            <span className="text-xs text-slate-500">
              CSV or Excel (.xlsx) files
            </span>
          </label>
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed font-medium"
        >
          {uploading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Import Chef Summary
            </>
          )}
        </button>
      </div>

      <div className="mt-6 p-4 bg-slate-50 rounded-lg">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">File Requirements:</h3>
        <ul className="text-xs text-slate-600 space-y-1">
          <li>• CSV or Excel format from the weekly chef performance summary (new or legacy template)</li>
          <li>• Must include location name/code, period, and week number</li>
          <li>• File will be imported or updated if it already exists</li>
        </ul>
      </div>
    </div>
  );
}
