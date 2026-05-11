import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

export function useLocationFilter(storageKey: string) {
  const { user } = useAuth();
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [isFiltered, setIsFilteredState] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPreferences();
    } else {
      setPreferredLocations([]);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const saved = localStorage.getItem(`location_filter_${storageKey}`);
    if (saved === 'true') {
      setIsFilteredState(true);
    }
  }, [storageKey]);

  const loadPreferences = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('user_location_preferences')
      .select('location_name')
      .eq('user_id', user.id);

    if (!error && data) {
      setPreferredLocations(data.map((r: { location_name: string }) => r.location_name));
      if (data.length > 0) {
        const saved = localStorage.getItem(`location_filter_${storageKey}`);
        if (saved === null) {
          setIsFilteredState(true);
        }
      }
    }
    setLoading(false);
  };

  const setIsFiltered = useCallback((val: boolean) => {
    setIsFilteredState(val);
    localStorage.setItem(`location_filter_${storageKey}`, val ? 'true' : 'false');
  }, [storageKey]);

  const hasPreferences = preferredLocations.length > 0;

  const filterLocations = useCallback(<T extends { name?: string; location_name?: string }>(
    items: T[],
    getKey?: (item: T) => string
  ): T[] => {
    if (!isFiltered || !hasPreferences) return items;
    return items.filter(item => {
      const key = getKey ? getKey(item) : (item.name ?? item.location_name ?? '');
      return preferredLocations.includes(key);
    });
  }, [isFiltered, hasPreferences, preferredLocations]);

  return {
    preferredLocations,
    hasPreferences,
    isFiltered,
    setIsFiltered,
    filterLocations,
    loading,
    reload: loadPreferences,
  };
}
