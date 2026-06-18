import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, LogOut, ChevronDown, FileText, AlertTriangle, Download, RefreshCw, ClipboardCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { exportChefSummaryToExcel } from '../lib/chefSummaryExport';
import { calculateNeedToSave, NeedToSaveBasis } from '../lib/needToSave';
import { GuidedWeeklyPackage, GuidedFieldUpdates } from './GuidedWeeklyPackage';

interface FeatureItem {
  name: string;
  sold: number;
  notes: string;
}

interface WeeklySummaryData {
  id?: string;
  location_id: string;
  week_number: number;
  period_number: number;
  fiscal_year: number;
  budget_food_cost_pct: number;
  on_hand_amount: number;
  sage_food_sales_qtd: number;
  sage_fcost_qtd_pct: number;
  food_cost_ptd_pct: number;
  sage_sales_budget_qtd: number;
  fc_qtd_pct: number;
  qtd_variance_pct: number;
  usage_amount: number;
  ideal_usage_amount: number;
  cogs_qtd: number;
  food_sales_labour_push: number;
  food_sales_oc: number;
  week_variance_amount: number;
  budget_food_sales_period: number;
  qtd_variance_amount: number;
  labour_budget_pct: number;
  sage_labour_budget_qtd_pct: number;
  sage_lcost_qtd_pct: number;
  labour_cost_ptd_pct: number;
  labour_qtd_pct: number;
  lab_ptd_var_amount: number;
  qtd_labour_variance_pct: number;
  labour_spent: number;
  overtime_amount: number;
  overtime_notes: string;
  labour_review_action_plan: string;
  lab_qtd_var_amount: number;
  labour_transfer_vacation: number;
  labour_transfer_management: number;
  labour_transfer_other: number;
  labour_transfer_notes: string;
  ebidta_budget_period_pct: number;
  ebidta_ptd_pct: number;
  ebidta_variance_pct: number;
  qsr_weekend_lunch_time: string;
  qsr_expo_time: string;
  teamshare_amount: number;
  petty_cash: number;
  waste_amount: number;
  last_audit_score_pct: number;
  boh_promo_amount: number;
  promo_ptd: number;
  promo_qtd: number;
  sous_vac_days: number;
  fc_need_save_per_week: number;
  fc_need_save_per_day: number;
  food_cost_summary: string;
  labour_need_save_per_week: number;
  labour_need_save_per_day: number;
  labour_summary: string;
  boh_promo_summary: string;
  notes: string;
  action_plan_summary: string;
  rm_issues_cleaning_focus: string;
  ideal_cooks: number;
  current_cooks: number;
  ideal_prep: number;
  current_prep: number;
  ideal_dish: number;
  current_dish: number;
  ideal_other: number;
  current_other: number;
  hiring_notes: string;
  tm_mots_of_note: string;
  development_path_updates: string;
  feature_items: FeatureItem[];
}

interface SavedSummaryOption {
  id: string;
  fiscal_year: number;
  period_number: number;
  week_number: number;
}

interface WeeklyChefSummaryProps {
  locationId: string;
  locationName: string;
  summaryId?: string;
}

export function WeeklyChefSummary({ locationId, locationName, summaryId }: WeeklyChefSummaryProps) {
  const { logout } = useAuth();
  const [formData, setFormData] = useState<WeeklySummaryData>({
    location_id: locationId,
    week_number: 1,
    period_number: 1,
    fiscal_year: 2026,
    budget_food_cost_pct: 0,
    on_hand_amount: 0,
    sage_food_sales_qtd: 0,
    sage_fcost_qtd_pct: 0,
    food_cost_ptd_pct: 0,
    sage_sales_budget_qtd: 0,
    fc_qtd_pct: 0,
    qtd_variance_pct: 0,
    usage_amount: 0,
    ideal_usage_amount: 0,
    cogs_qtd: 0,
    food_sales_labour_push: 0,
    food_sales_oc: 0,
    week_variance_amount: 0,
    budget_food_sales_period: 0,
    qtd_variance_amount: 0,
    labour_budget_pct: 0,
    sage_labour_budget_qtd_pct: 0,
    sage_lcost_qtd_pct: 0,
    labour_cost_ptd_pct: 0,
    labour_qtd_pct: 0,
    lab_ptd_var_amount: 0,
    qtd_labour_variance_pct: 0,
    labour_spent: 0,
    overtime_amount: 0,
    overtime_notes: '',
    labour_review_action_plan: '',
    lab_qtd_var_amount: 0,
    labour_transfer_vacation: 0,
    labour_transfer_management: 0,
    labour_transfer_other: 0,
    labour_transfer_notes: '',
    ebidta_budget_period_pct: 0,
    ebidta_ptd_pct: 0,
    ebidta_variance_pct: 0,
    qsr_weekend_lunch_time: '',
    qsr_expo_time: '',
    teamshare_amount: 0,
    petty_cash: 0,
    waste_amount: 0,
    last_audit_score_pct: 0,
    boh_promo_amount: 0,
    promo_ptd: 0,
    promo_qtd: 0,
    sous_vac_days: 0,
    fc_need_save_per_week: 0,
    fc_need_save_per_day: 0,
    food_cost_summary: '',
    labour_need_save_per_week: 0,
    labour_need_save_per_day: 0,
    labour_summary: '',
    boh_promo_summary: '',
    notes: '',
    action_plan_summary: '',
    rm_issues_cleaning_focus: '',
    ideal_cooks: 0,
    current_cooks: 0,
    ideal_prep: 0,
    current_prep: 0,
    ideal_dish: 0,
    current_dish: 0,
    ideal_other: 0,
    current_other: 0,
    hiring_notes: '',
    tm_mots_of_note: '',
    development_path_updates: '',
    feature_items: [{ name: '', sold: 0, notes: '' }]
  });

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!summaryId);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [savedSummaries, setSavedSummaries] = useState<SavedSummaryOption[]>([]);
  const [activeSummaryId, setActiveSummaryId] = useState<string | null>(summaryId || null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [calculatingNTS, setCalculatingNTS] = useState(false);
  const [ntsContext, setNtsContext] = useState<{
    fc_basis: NeedToSaveBasis;
    fc_variance_dollars: number;
    fc_weeks_remaining: number;
    labour_basis: NeedToSaveBasis;
    labour_variance_dollars: number;
    labour_weeks_remaining: number;
  } | null>(null);

  const weekBudget = formData.budget_food_sales_period > 0 ? formData.budget_food_sales_period / 4 : 0;
  const weekVarianceAmount = formData.food_sales_labour_push > 0 ? formData.food_sales_labour_push - weekBudget : 0;
  const actualFoodCostPct = formData.food_sales_labour_push > 0 ? (formData.usage_amount / formData.food_sales_labour_push) * 100 : 0;
  const fcVariance = actualFoodCostPct - formData.budget_food_cost_pct;
  const theoreticalFoodCostPct = formData.food_sales_labour_push > 0 ? (formData.ideal_usage_amount / formData.food_sales_labour_push) * 100 : 0;
  const theoreticalVariance = actualFoodCostPct - theoreticalFoodCostPct;
  const labourCostPct = formData.food_sales_labour_push > 0 ? (formData.labour_spent / formData.food_sales_labour_push) * 100 : 0;
  const lcVariance = labourCostPct - formData.labour_budget_pct;
  const foodSalesSWvsOC = formData.food_sales_oc - formData.food_sales_labour_push;

  useEffect(() => {
    const init = async () => {
      await loadSavedSummaries();
      if (summaryId) {
        loadSummary(summaryId);
      } else {
        const autofill = await buildAutofillData();
        if (Object.keys(autofill).length > 0) {
          setFormData(prev => ({ ...prev, ...autofill }));
        }
      }
    };
    init();
  }, [locationId]);

  const loadSavedSummaries = async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_chef_summary')
        .select('id, fiscal_year, period_number, week_number')
        .eq('location_id', locationId)
        .order('fiscal_year', { ascending: false })
        .order('period_number', { ascending: false })
        .order('week_number', { ascending: false });

      if (error) throw error;
      setSavedSummaries(data || []);
    } catch (error) {
      console.error('Error loading saved summaries:', error);
    }
  };

  const loadSummary = async (id: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('weekly_chef_summary')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setFormData(data);
        setActiveSummaryId(id);
      }
    } catch (error) {
      console.error('Error loading summary:', error);
      setMessage({ type: 'error', text: 'Failed to load summary' });
    } finally {
      setLoading(false);
    }
  };

  const getQuarterPeriods = (period: number): number[] => {
    if (period <= 3) return [1, 2, 3];
    if (period <= 6) return [4, 5, 6];
    if (period <= 9) return [7, 8, 9];
    return [10, 11, 12, 13];
  };

  const fetchPLDataForPeriod = async (
    locId: string,
    fiscalYear: number,
    periodNumber: number
  ): Promise<{ budget_food_sales_period: number; sage_food_sales_qtd: number; sage_sales_budget_qtd: number; budget_food_cost_pct: number; labour_budget_pct: number } | null> => {
    try {
      const quarterPeriods = getQuarterPeriods(periodNumber);

      const { data: calWeeks } = await supabase
        .from('fiscal_calendar')
        .select('end_date, period, week')
        .eq('fiscal_year', fiscalYear)
        .in('period', quarterPeriods)
        .order('period', { ascending: true })
        .order('week', { ascending: true });

      if (!calWeeks || calWeeks.length === 0) return null;

      const quarterEndDates = calWeeks.map(w => w.end_date);

      const { data: uploads } = await supabase
        .from('pl_uploads')
        .select('id, week_ending_date')
        .eq('location_id', locId)
        .in('week_ending_date', quarterEndDates)
        .order('week_ending_date', { ascending: true });

      if (!uploads || uploads.length === 0) return null;

      const uploadIds = uploads.map(u => u.id);

      const { data: lineItems } = await supabase
        .from('pl_line_items')
        .select('upload_id, line_item_name, current_actual, current_budget, current_actual_pct, current_budget_pct')
        .in('upload_id', uploadIds)
        .in('line_item_name', ['Food Sales', 'Cost of Sales (Food)', 'Kitchen Labour']);

      if (!lineItems || lineItems.length === 0) return null;

      const currentPeriodUploads = uploads.filter(u => {
        const matchingCal = calWeeks.find(c => c.end_date === u.week_ending_date);
        return matchingCal && matchingCal.period === periodNumber;
      });

      let budget_food_sales_period = 0;
      let budget_food_cost_pct = 0;
      let labour_budget_pct = 0;

      if (currentPeriodUploads.length > 0) {
        const latestUploadId = currentPeriodUploads[currentPeriodUploads.length - 1].id;
        const latestFoodSales = lineItems.find(
          i => i.upload_id === latestUploadId && i.line_item_name === 'Food Sales'
        );
        const latestFoodCost = lineItems.find(
          i => i.upload_id === latestUploadId && i.line_item_name === 'Cost of Sales (Food)'
        );
        const latestLabour = lineItems.find(
          i => i.upload_id === latestUploadId && i.line_item_name === 'Kitchen Labour'
        );

        if (latestFoodSales) {
          budget_food_sales_period = latestFoodSales.current_budget || 0;
        }
        if (latestFoodCost) {
          budget_food_cost_pct = latestFoodCost.current_budget_pct || 0;
        }
        if (latestLabour) {
          labour_budget_pct = latestLabour.current_budget_pct || 0;
        }
      }

      let sage_food_sales_qtd = 0;
      let sage_sales_budget_qtd = 0;

      const periodsInQtr = [...new Set(uploads.map(u => {
        const cal = calWeeks.find(c => c.end_date === u.week_ending_date);
        return cal?.period;
      }).filter(Boolean))] as number[];

      for (const p of periodsInQtr) {
        const periodUploads = uploads.filter(u => {
          const cal = calWeeks.find(c => c.end_date === u.week_ending_date);
          return cal && cal.period === p;
        });
        if (periodUploads.length > 0) {
          const latestUpload = periodUploads[periodUploads.length - 1];
          const foodSalesItem = lineItems.find(
            i => i.upload_id === latestUpload.id && i.line_item_name === 'Food Sales'
          );
          if (foodSalesItem) {
            sage_food_sales_qtd += foodSalesItem.current_actual || 0;
            sage_sales_budget_qtd += foodSalesItem.current_budget || 0;
          }
        }
      }

      return { budget_food_sales_period, sage_food_sales_qtd, sage_sales_budget_qtd, budget_food_cost_pct, labour_budget_pct };
    } catch {
      return null;
    }
  };

  const buildAutofillData = async (): Promise<Partial<WeeklySummaryData>> => {
    try {
      const { data: prev, error } = await supabase
        .from('weekly_chef_summary')
        .select('*')
        .eq('location_id', locationId)
        .order('fiscal_year', { ascending: false })
        .order('period_number', { ascending: false })
        .order('week_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextFiscalYear: number;
      let nextPeriod: number;
      let nextWeek: number;

      if (error || !prev) {
        const { data: currentCal } = await supabase
          .from('fiscal_calendar')
          .select('fiscal_year, period, week')
          .eq('is_current', true)
          .maybeSingle();

        if (!currentCal) return {};

        nextFiscalYear = currentCal.fiscal_year;
        nextPeriod = currentCal.period;
        nextWeek = currentCal.week;
      } else {
        const prevWeek: number = prev.week_number;
        const prevPeriod: number = prev.period_number;

        nextWeek = prevWeek >= 4 ? 1 : prevWeek + 1;
        nextPeriod = prevWeek >= 4 ? prevPeriod + 1 : prevPeriod;
        nextFiscalYear = prev.fiscal_year;
      }

      const plData = await fetchPLDataForPeriod(locationId, nextFiscalYear, nextPeriod);

      const result: Partial<WeeklySummaryData> = {
        fiscal_year: nextFiscalYear,
        period_number: nextPeriod,
        week_number: nextWeek,
      };

      if (plData) {
        result.budget_food_sales_period = plData.budget_food_sales_period;
        result.sage_food_sales_qtd = plData.sage_food_sales_qtd;
        result.sage_sales_budget_qtd = plData.sage_sales_budget_qtd;
        result.budget_food_cost_pct = plData.budget_food_cost_pct;
        result.labour_budget_pct = plData.labour_budget_pct;
      } else if (prev) {
        result.budget_food_sales_period = prev.budget_food_sales_period;
        result.budget_food_cost_pct = prev.budget_food_cost_pct;
        result.labour_budget_pct = prev.labour_budget_pct;
      }

      if (prev) {
        result.ideal_cooks = prev.ideal_cooks;
        result.ideal_prep = prev.ideal_prep;
        result.ideal_dish = prev.ideal_dish;
        result.ideal_other = prev.ideal_other;
      }

      return result;
    } catch {
      return {};
    }
  };

  const blankFormData = (): WeeklySummaryData => ({
    location_id: locationId,
    week_number: 1,
    period_number: 1,
    fiscal_year: 2026,
    budget_food_cost_pct: 0,
    on_hand_amount: 0,
    sage_food_sales_qtd: 0,
    sage_fcost_qtd_pct: 0,
    food_cost_ptd_pct: 0,
    sage_sales_budget_qtd: 0,
    fc_qtd_pct: 0,
    qtd_variance_pct: 0,
    usage_amount: 0,
    ideal_usage_amount: 0,
    cogs_qtd: 0,
    food_sales_labour_push: 0,
    food_sales_oc: 0,
    week_variance_amount: 0,
    budget_food_sales_period: 0,
    qtd_variance_amount: 0,
    labour_budget_pct: 0,
    sage_labour_budget_qtd_pct: 0,
    sage_lcost_qtd_pct: 0,
    labour_cost_ptd_pct: 0,
    labour_qtd_pct: 0,
    lab_ptd_var_amount: 0,
    qtd_labour_variance_pct: 0,
    labour_spent: 0,
    overtime_amount: 0,
    overtime_notes: '',
    labour_review_action_plan: '',
    lab_qtd_var_amount: 0,
    labour_transfer_vacation: 0,
    labour_transfer_management: 0,
    labour_transfer_other: 0,
    labour_transfer_notes: '',
    ebidta_budget_period_pct: 0,
    ebidta_ptd_pct: 0,
    ebidta_variance_pct: 0,
    qsr_weekend_lunch_time: '',
    qsr_expo_time: '',
    teamshare_amount: 0,
    petty_cash: 0,
    waste_amount: 0,
    last_audit_score_pct: 0,
    boh_promo_amount: 0,
    promo_ptd: 0,
    promo_qtd: 0,
    sous_vac_days: 0,
    fc_need_save_per_week: 0,
    fc_need_save_per_day: 0,
    food_cost_summary: '',
    labour_need_save_per_week: 0,
    labour_need_save_per_day: 0,
    labour_summary: '',
    boh_promo_summary: '',
    notes: '',
    action_plan_summary: '',
    rm_issues_cleaning_focus: '',
    ideal_cooks: 0,
    current_cooks: 0,
    ideal_prep: 0,
    current_prep: 0,
    ideal_dish: 0,
    current_dish: 0,
    ideal_other: 0,
    current_other: 0,
    hiring_notes: '',
    tm_mots_of_note: '',
    development_path_updates: '',
    feature_items: [{ name: '', sold: 0, notes: '' }]
  });

  const handleSelectSummary = async (value: string) => {
    if (value === 'new') {
      const autofill = await buildAutofillData();
      setFormData({ ...blankFormData(), ...autofill });
      setActiveSummaryId(null);
      setMessage(null);
    } else {
      loadSummary(value);
    }
  };

  const handleInputChange = (field: keyof WeeklySummaryData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGuideFieldsChange = (updates: GuidedFieldUpdates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const addFeatureItem = () => {
    setFormData(prev => ({
      ...prev,
      feature_items: [...prev.feature_items, { name: '', sold: 0, notes: '' }]
    }));
  };

  const removeFeatureItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      feature_items: prev.feature_items.filter((_, i) => i !== index)
    }));
  };

  const updateFeatureItem = (index: number, field: keyof FeatureItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      feature_items: prev.feature_items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleCalculateNeedToSave = async () => {
    setCalculatingNTS(true);
    try {
      const result = await calculateNeedToSave(
        locationId,
        formData.fiscal_year,
        formData.period_number,
        formData.week_number
      );
      if (result) {
        setFormData(prev => ({
          ...prev,
          fc_need_save_per_week: parseFloat(result.fc_need_save_per_week.toFixed(2)),
          fc_need_save_per_day: parseFloat(result.fc_need_save_per_day.toFixed(2)),
          labour_need_save_per_week: parseFloat(result.labour_need_save_per_week.toFixed(2)),
          labour_need_save_per_day: parseFloat(result.labour_need_save_per_day.toFixed(2)),
        }));
        setNtsContext({
          fc_basis: result.fc_basis,
          fc_variance_dollars: result.fc_variance_dollars,
          fc_weeks_remaining: result.fc_weeks_remaining,
          labour_basis: result.labour_basis,
          labour_variance_dollars: result.labour_variance_dollars,
          labour_weeks_remaining: result.labour_weeks_remaining,
        });
      } else {
        setMessage({ type: 'error', text: 'No P&L data found for this location. Upload a P&L statement first.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to calculate need-to-save values.' });
    } finally {
      setCalculatingNTS(false);
    }
  };

  const fetchPTDFromPL = async (): Promise<{ food_cost_ptd_pct: number; labour_cost_ptd_pct: number }> => {
    try {
      const { data: calWeek } = await supabase
        .from('fiscal_calendar')
        .select('end_date')
        .eq('fiscal_year', formData.fiscal_year)
        .eq('period', formData.period_number)
        .eq('week', formData.week_number)
        .maybeSingle();

      if (!calWeek) return { food_cost_ptd_pct: 0, labour_cost_ptd_pct: 0 };

      const { data: upload } = await supabase
        .from('pl_uploads')
        .select('id')
        .eq('location_id', locationId)
        .eq('week_ending_date', calWeek.end_date)
        .maybeSingle();

      if (!upload) return { food_cost_ptd_pct: 0, labour_cost_ptd_pct: 0 };

      const { data: items } = await supabase
        .from('pl_line_items')
        .select('line_item_name, current_actual_pct')
        .eq('upload_id', upload.id)
        .in('line_item_name', ['Cost of Sales (Food)', 'Kitchen Labour']);

      const foodCost = items?.find(i => i.line_item_name === 'Cost of Sales (Food)');
      const labour = items?.find(i => i.line_item_name === 'Kitchen Labour');

      return {
        food_cost_ptd_pct: foodCost?.current_actual_pct || 0,
        labour_cost_ptd_pct: labour?.current_actual_pct || 0,
      };
    } catch {
      return { food_cost_ptd_pct: 0, labour_cost_ptd_pct: 0 };
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const ptdData = await fetchPTDFromPL();

      const { error } = await supabase
        .from('weekly_chef_summary')
        .upsert({
          ...formData,
          week_budget: weekBudget,
          week_variance_amount: weekVarianceAmount,
          qtd_variance_amount: formData.sage_food_sales_qtd - formData.sage_sales_budget_qtd,
          food_cost_ptd_pct: ptdData.food_cost_ptd_pct,
          labour_cost_ptd_pct: ptdData.labour_cost_ptd_pct,
          actual_food_cost_pct: actualFoodCostPct,
          fc_variance: fcVariance,
          theoretical_food_cost_pct: theoreticalFoodCostPct,
          theoretical_variance: theoreticalVariance,
          labour_cost_pct: labourCostPct,
          lc_variance: lcVariance,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'location_id,fiscal_year,period_number,week_number'
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Weekly summary saved successfully!' });
      await loadSavedSummaries();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save summary'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeSummaryId) return;
    try {
      setDeleting(true);
      const { error } = await supabase
        .from('weekly_chef_summary')
        .delete()
        .eq('id', activeSummaryId);

      if (error) throw error;

      setShowDeleteConfirm(false);
      setActiveSummaryId(null);
      setFormData(blankFormData());
      setMessage({ type: 'success', text: 'Summary deleted successfully.' });
      await loadSavedSummaries();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete summary'
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = () => {
    exportChefSummaryToExcel(
      formData,
      locationName,
      weekBudget,
      actualFoodCostPct,
      fcVariance,
      theoreticalFoodCostPct,
      theoreticalVariance,
      labourCostPct,
      lcVariance
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800"></div>
          <p className="mt-4 text-slate-600">Loading summary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">{locationName}</h1>
              <h2 className="text-xl text-slate-600">Weekly Chef Summary {activeSummaryId && '(Editing)'}</h2>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 shrink-0">
              <FileText className="w-4 h-4 text-slate-500" />
              Saved Summaries
            </div>
            <div className="relative flex-1 min-w-0">
              <select
                value={activeSummaryId || 'new'}
                onChange={(e) => handleSelectSummary(e.target.value)}
                className="w-full appearance-none pl-3 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 bg-white text-slate-800 text-sm cursor-pointer"
              >
                <option value="new">+ New Summary</option>
                {savedSummaries.map((s) => (
                  <option key={s.id} value={s.id}>
                    FY{s.fiscal_year} &mdash; Period {s.period_number}, Week {s.week_number}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            <button
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors text-sm shrink-0"
              title="Open the guided weekly package"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Guided Package</span>
            </button>
            {activeSummaryId && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors text-sm shrink-0"
                title="Delete this summary"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
            {savedSummaries.length === 0 && (
              <span className="text-xs text-slate-400 shrink-0">No saved summaries yet</span>
            )}
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Delete Summary</h3>
                  <p className="text-sm text-slate-500 mt-0.5">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm text-slate-700 mb-6">
                Are you sure you want to delete this chef summary? All data for this week will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {showGuide && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm py-8 px-4">
            <GuidedWeeklyPackage
              initialValues={{
                budget_food_sales_period: formData.budget_food_sales_period,
                labour_budget_pct: formData.labour_budget_pct,
                food_sales_labour_push: formData.food_sales_labour_push,
                labour_spent: formData.labour_spent,
                overtime_amount: formData.overtime_amount,
                overtime_notes: formData.overtime_notes,
                boh_promo_amount: formData.boh_promo_amount,
                labour_transfer_vacation: formData.labour_transfer_vacation,
                labour_transfer_management: formData.labour_transfer_management,
                labour_transfer_other: formData.labour_transfer_other,
                labour_transfer_notes: formData.labour_transfer_notes,
                labour_review_action_plan: formData.labour_review_action_plan,
              }}
              onFieldsChange={handleGuideFieldsChange}
              onClose={() => setShowGuide(false)}
              locationId={locationId}
              locationName={locationName}
              fiscalYear={formData.fiscal_year}
              periodNumber={formData.period_number}
              weekNumber={formData.week_number}
            />
          </div>
        )}

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Period Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Fiscal Year</label>
                <input
                  type="number"
                  value={formData.fiscal_year || ''}
                  onChange={(e) => handleInputChange('fiscal_year', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Period</label>
                <input
                  type="number"
                  value={formData.period_number || ''}
                  onChange={(e) => handleInputChange('period_number', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Week</label>
                <input
                  type="number"
                  value={formData.week_number || ''}
                  onChange={(e) => handleInputChange('week_number', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Sales Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Food Sales Labour Push</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.food_sales_labour_push || ''}
                  onChange={(e) => handleInputChange('food_sales_labour_push', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Food Sales OC</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.food_sales_oc || ''}
                  onChange={(e) => handleInputChange('food_sales_oc', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Food Sales SW vs OC <span className="text-xs text-slate-400">(calculated)</span></label>
                <div className={`w-full px-3 py-2 border rounded-lg font-medium ${foodSalesSWvsOC >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {foodSalesSWvsOC >= 0 ? '+' : ''}${foodSalesSWvsOC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Budget Food Sales (Period)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.budget_food_sales_period || ''}
                  onChange={(e) => handleInputChange('budget_food_sales_period', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Week Budget <span className="text-xs text-slate-400">(calculated)</span></label>
                <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium">
                  ${weekBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">+/- Budget <span className="text-xs text-slate-400">(calculated)</span></label>
                <div className={`w-full px-3 py-2 border rounded-lg font-medium ${weekVarianceAmount >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {weekVarianceAmount >= 0 ? '+' : ''}${weekVarianceAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Sage Food Sales QTD</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.sage_food_sales_qtd || ''}
                  onChange={(e) => handleInputChange('sage_food_sales_qtd', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Sage Sales Budget QTD</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.sage_sales_budget_qtd || ''}
                  onChange={(e) => handleInputChange('sage_sales_budget_qtd', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">QTD Sales Variance <span className="text-xs text-slate-400">(calculated)</span></label>
                <div className={`w-full px-3 py-2 border rounded-lg font-medium ${(formData.sage_food_sales_qtd - formData.sage_sales_budget_qtd) >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {(formData.sage_food_sales_qtd - formData.sage_sales_budget_qtd) >= 0 ? '+' : ''}${(formData.sage_food_sales_qtd - formData.sage_sales_budget_qtd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Food Cost Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Usage Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.usage_amount || ''}
                  onChange={(e) => handleInputChange('usage_amount', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ideal Usage</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ideal_usage_amount || ''}
                  onChange={(e) => handleInputChange('ideal_usage_amount', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Petty Cash</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.petty_cash || ''}
                  onChange={(e) => handleInputChange('petty_cash', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Budget Food Cost %</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.budget_food_cost_pct || ''}
                  onChange={(e) => handleInputChange('budget_food_cost_pct', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Actual Food Cost % <span className="text-xs text-slate-400">(calculated)</span></label>
                <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium">
                  {actualFoodCostPct.toFixed(2)}%
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">FC Variance <span className="text-xs text-slate-400">(calculated)</span></label>
                <div className={`w-full px-3 py-2 border rounded-lg font-medium ${fcVariance <= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {fcVariance > 0 ? '+' : ''}{fcVariance.toFixed(2)}%
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Theoretical Food Cost % <span className="text-xs text-slate-400">(calculated)</span></label>
                <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium">
                  {theoreticalFoodCostPct.toFixed(2)}%
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Theoretical Variance <span className="text-xs text-slate-400">(calculated)</span></label>
                <div className={`w-full px-3 py-2 border rounded-lg font-medium ${theoreticalVariance <= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {theoreticalVariance > 0 ? '+' : ''}{theoreticalVariance.toFixed(2)}%
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">On Hand Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.on_hand_amount || ''}
                  onChange={(e) => handleInputChange('on_hand_amount', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Labour Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Labour Spent</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.labour_spent || ''}
                  onChange={(e) => handleInputChange('labour_spent', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Overtime</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.overtime_amount || ''}
                  onChange={(e) => handleInputChange('overtime_amount', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Sous Vac Days</label>
                <input
                  type="number"
                  value={formData.sous_vac_days || ''}
                  onChange={(e) => handleInputChange('sous_vac_days', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Labour Budget %</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.labour_budget_pct || ''}
                  onChange={(e) => handleInputChange('labour_budget_pct', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Labour Cost % <span className="text-xs text-slate-400">(calculated)</span></label>
                <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium">
                  {labourCostPct.toFixed(2)}%
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">LC Variance <span className="text-xs text-slate-400">(calculated)</span></label>
                <div className={`w-full px-3 py-2 border rounded-lg font-medium ${lcVariance <= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {lcVariance > 0 ? '+' : ''}{lcVariance.toFixed(2)}%
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Transfer to Vacation <span className="text-xs text-slate-400">(from guide)</span></label>
                <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium">
                  ${(formData.labour_transfer_vacation || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Transfer to Management Labour <span className="text-xs text-slate-400">(from guide)</span></label>
                <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium">
                  ${(formData.labour_transfer_management || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Transfer to Other <span className="text-xs text-slate-400">(from guide)</span></label>
                <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium">
                  ${(formData.labour_transfer_other || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-2">Labour Transfer Notes</label>
                <textarea
                  value={formData.labour_transfer_notes}
                  onChange={(e) => handleInputChange('labour_transfer_notes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-2">Overtime Explanation <span className="text-xs text-slate-400">(from guide)</span></label>
                <textarea
                  value={formData.overtime_notes}
                  onChange={(e) => handleInputChange('overtime_notes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-2">Labour Review Action Plan <span className="text-xs text-slate-400">(from guide)</span></label>
                <textarea
                  value={formData.labour_review_action_plan}
                  onChange={(e) => handleInputChange('labour_review_action_plan', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Other Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">QSR Weekend Lunch Time</label>
                <input
                  type="text"
                  value={formData.qsr_weekend_lunch_time}
                  onChange={(e) => handleInputChange('qsr_weekend_lunch_time', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">QSR Expo Time</label>
                <input
                  type="text"
                  value={formData.qsr_expo_time}
                  onChange={(e) => handleInputChange('qsr_expo_time', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Teamshare</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.teamshare_amount || ''}
                  onChange={(e) => handleInputChange('teamshare_amount', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Waste</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.waste_amount || ''}
                  onChange={(e) => handleInputChange('waste_amount', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Last Audit Score %</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.last_audit_score_pct || ''}
                  onChange={(e) => handleInputChange('last_audit_score_pct', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="md:col-span-3 grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">BOH Promo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.boh_promo_amount || ''}
                    onChange={(e) => handleInputChange('boh_promo_amount', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Promo PTD</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.promo_ptd || ''}
                    onChange={(e) => handleInputChange('promo_ptd', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Promo QTD</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.promo_qtd || ''}
                    onChange={(e) => handleInputChange('promo_qtd', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Team Staffing</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-4 font-medium text-slate-700 text-sm pb-1 border-b border-slate-100">
                <div>Position</div>
                <div>Ideal #</div>
                <div>Current #</div>
                <div>Needed</div>
              </div>
              {(
                [
                  { label: 'Cooks', ideal: 'ideal_cooks' as const, current: 'current_cooks' as const },
                  { label: 'Prep', ideal: 'ideal_prep' as const, current: 'current_prep' as const },
                  { label: 'Dish', ideal: 'ideal_dish' as const, current: 'current_dish' as const },
                  { label: 'Other', ideal: 'ideal_other' as const, current: 'current_other' as const },
                ] as const
              ).map(({ label, ideal, current }) => {
                const needed = (formData[ideal] || 0) - (formData[current] || 0);
                return (
                  <div key={label} className="grid grid-cols-4 gap-4 items-center">
                    <div className="text-sm font-medium text-slate-700">{label}</div>
                    <input
                      type="number"
                      value={formData[ideal] || ''}
                      onChange={(e) => handleInputChange(ideal, parseInt(e.target.value) || 0)}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <input
                      type="number"
                      value={formData[current] || ''}
                      onChange={(e) => handleInputChange(current, parseInt(e.target.value) || 0)}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className={`px-3 py-2 border rounded-lg font-medium text-sm ${needed > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : needed < 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                      {needed > 0 ? `+${needed} needed` : needed < 0 ? `${Math.abs(needed)} over` : 'Fully staffed'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Feature Items</h3>
            <div className="space-y-4">
              {formData.feature_items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  <div className="md:col-span-4">
                    <input
                      type="text"
                      placeholder="Feature name"
                      value={item.name}
                      onChange={(e) => updateFeatureItem(index, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="number"
                      placeholder="Sold"
                      value={item.sold || ''}
                      onChange={(e) => updateFeatureItem(index, 'sold', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="md:col-span-5">
                    <input
                      type="text"
                      placeholder="Notes"
                      value={item.notes}
                      onChange={(e) => updateFeatureItem(index, 'notes', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <button
                      onClick={() => removeFeatureItem(index)}
                      className="w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={addFeatureItem}
                className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Feature Item
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Summaries & Notes</h3>
            <div className="space-y-4">

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-700">Need to Save — from P&L</p>
                  <button
                    type="button"
                    onClick={handleCalculateNeedToSave}
                    disabled={calculatingNTS}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${calculatingNTS ? 'animate-spin' : ''}`} />
                    {calculatingNTS ? 'Calculating...' : 'Calculate from P&L'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Food Cost</p>
                    {ntsContext && ntsContext.fc_basis !== 'none' && (
                      <div className="mb-2 px-2 py-1.5 bg-amber-50 border border-amber-100 rounded text-xs text-amber-700">
                        Based on <span className="font-semibold">{ntsContext.fc_basis.toUpperCase()}</span> variance of{' '}
                        <span className="font-semibold">${Math.abs(ntsContext.fc_variance_dollars).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        {' '}over <span className="font-semibold">{ntsContext.fc_weeks_remaining}</span> week{ntsContext.fc_weeks_remaining !== 1 ? 's' : ''} remaining
                      </div>
                    )}
                    {ntsContext && ntsContext.fc_basis === 'none' && (
                      <div className="mb-2 px-2 py-1.5 bg-green-50 border border-green-100 rounded text-xs text-green-700 font-medium">
                        On track — all horizons green
                      </div>
                    )}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Per Week</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.fc_need_save_per_week || ''}
                          onChange={(e) => handleInputChange('fc_need_save_per_week', parseFloat(e.target.value) || 0)}
                          className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${formData.fc_need_save_per_week > 0 ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-300 bg-white text-slate-700'}`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Per Day</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.fc_need_save_per_day || ''}
                          onChange={(e) => handleInputChange('fc_need_save_per_day', parseFloat(e.target.value) || 0)}
                          className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${formData.fc_need_save_per_day > 0 ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-300 bg-white text-slate-700'}`}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Labour</p>
                    {ntsContext && ntsContext.labour_basis !== 'none' && (
                      <div className="mb-2 px-2 py-1.5 bg-blue-50 border border-blue-100 rounded text-xs text-blue-700">
                        Based on <span className="font-semibold">{ntsContext.labour_basis.toUpperCase()}</span> variance of{' '}
                        <span className="font-semibold">${Math.abs(ntsContext.labour_variance_dollars).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        {' '}over <span className="font-semibold">{ntsContext.labour_weeks_remaining}</span> week{ntsContext.labour_weeks_remaining !== 1 ? 's' : ''} remaining
                      </div>
                    )}
                    {ntsContext && ntsContext.labour_basis === 'none' && (
                      <div className="mb-2 px-2 py-1.5 bg-green-50 border border-green-100 rounded text-xs text-green-700 font-medium">
                        On track — all horizons green
                      </div>
                    )}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Per Week</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.labour_need_save_per_week || ''}
                          onChange={(e) => handleInputChange('labour_need_save_per_week', parseFloat(e.target.value) || 0)}
                          className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${formData.labour_need_save_per_week > 0 ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-slate-300 bg-white text-slate-700'}`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Per Day</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.labour_need_save_per_day || ''}
                          onChange={(e) => handleInputChange('labour_need_save_per_day', parseFloat(e.target.value) || 0)}
                          className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:ring-2 focus:ring-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${formData.labour_need_save_per_day > 0 ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-slate-300 bg-white text-slate-700'}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Food Cost Summary</label>
                <textarea
                  value={formData.food_cost_summary}
                  onChange={(e) => handleInputChange('food_cost_summary', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Labour Summary</label>
                <textarea
                  value={formData.labour_summary}
                  onChange={(e) => handleInputChange('labour_summary', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">BOH Promo Summary</label>
                <textarea
                  value={formData.boh_promo_summary}
                  onChange={(e) => handleInputChange('boh_promo_summary', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Hiring Notes</label>
                <textarea
                  value={formData.hiring_notes}
                  onChange={(e) => handleInputChange('hiring_notes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">TM MOTs of Note</label>
                <textarea
                  value={formData.tm_mots_of_note}
                  onChange={(e) => handleInputChange('tm_mots_of_note', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Development Path Updates</label>
                <textarea
                  value={formData.development_path_updates}
                  onChange={(e) => handleInputChange('development_path_updates', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">R&M Issues / Cleaning Focus</label>
                <textarea
                  value={formData.rm_issues_cleaning_focus}
                  onChange={(e) => handleInputChange('rm_issues_cleaning_focus', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Action Plan Summary</label>
                <textarea
                  value={formData.action_plan_summary}
                  onChange={(e) => handleInputChange('action_plan_summary', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              <Download className="w-5 h-5" />
              Export to Excel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Weekly Summary'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
