import { useEffect, useState, useCallback } from "react";
import { usePropertiesQuery } from "./usePropertiesQuery";

const STORAGE_KEY = "filla_last_used_property";

export function useLastUsedProperty() {
  const { data: properties = [], isLoading: loading } = usePropertiesQuery();
  const [lastUsedPropertyId, setLastUsedPropertyId] = useState<string | null>(null);

  // Load last used from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setLastUsedPropertyId(stored);
    }
  }, []);

  // If no stored property but we have properties, use the most recently created one
  useEffect(() => {
    if (!loading && properties.length > 0 && !lastUsedPropertyId) {
      // Sort by created_at descending and pick the most recent
      const sorted = [...properties].sort((a, b) => {
        const aDate = new Date(a.created_at || 0).getTime();
        const bDate = new Date(b.created_at || 0).getTime();
        return bDate - aDate;
      });
      const mostRecent = sorted[0];
      if (mostRecent) {
        setLastUsedPropertyId(mostRecent.id);
        localStorage.setItem(STORAGE_KEY, mostRecent.id);
      }
    }
  }, [properties, loading, lastUsedPropertyId]);

  // Validate that the stored property still exists
  useEffect(() => {
    if (!loading && lastUsedPropertyId && properties.length > 0) {
      const exists = properties.some(p => p.id === lastUsedPropertyId);
      if (!exists) {
        // Property no longer exists, clear and use most recent
        const sorted = [...properties].sort((a, b) => {
          const aDate = new Date(a.created_at || 0).getTime();
          const bDate = new Date(b.created_at || 0).getTime();
          return bDate - aDate;
        });
        const mostRecent = sorted[0];
        if (mostRecent) {
          setLastUsedPropertyId(mostRecent.id);
          localStorage.setItem(STORAGE_KEY, mostRecent.id);
        } else {
          setLastUsedPropertyId(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
  }, [properties, loading, lastUsedPropertyId]);

  const setLastUsed = useCallback((propertyId: string) => {
    setLastUsedPropertyId(propertyId);
    localStorage.setItem(STORAGE_KEY, propertyId);
  }, []);

  return {
    lastUsedPropertyId,
    setLastUsed,
    loading,
    hasProperties: properties.length > 0,
  };
}
