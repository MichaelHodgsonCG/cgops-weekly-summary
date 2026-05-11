import { useState, useEffect } from 'react';
import { FiscalWeek, getCurrentFiscalPeriod, getFiscalYear } from './fiscalCalendar';

export function useCurrentFiscalPeriod() {
  const [currentPeriod, setCurrentPeriod] = useState<FiscalWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCurrentPeriod() {
      try {
        setLoading(true);
        const period = await getCurrentFiscalPeriod();
        setCurrentPeriod(period);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchCurrentPeriod();
  }, []);

  return { currentPeriod, loading, error };
}

export function useFiscalYear(year: number) {
  const [weeks, setWeeks] = useState<FiscalWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFiscalYear() {
      try {
        setLoading(true);
        const data = await getFiscalYear(year);
        setWeeks(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchFiscalYear();
  }, [year]);

  return { weeks, loading, error };
}

export function useFiscalCalendar(year: number) {
  const [weeks, setWeeks] = useState<FiscalWeek[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFiscalYear() {
      try {
        setLoading(true);
        const data = await getFiscalYear(year);
        setWeeks(data);
      } catch (err) {
        console.error('Error loading fiscal calendar:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchFiscalYear();
  }, [year]);

  const periods = Array.from(new Set(weeks.map(w => w.period))).sort((a, b) => a - b);
  const availableYears = [2024, 2025, 2026, 2027];

  return {
    weeks,
    periods,
    availableYears,
    loading
  };
}
