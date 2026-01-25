import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

interface PropertyFilterContextValue {
  // Active property IDs (Set for efficient lookups)
  // null = all properties active (default state)
  // Set<string> = specific properties active
  activePropertyIds: Set<string> | null;
  
  // Check if a property is active
  isPropertyActive: (propertyId: string) => boolean;
  
  // Check if all properties are active (default state)
  areAllPropertiesActive: boolean;
  
  // Toggle property selection following the mental model
  toggleProperty: (propertyId: string, allPropertyIds: string[]) => void;
  
  // Reset to all active
  resetToAllActive: () => void;
  
  // Set specific properties as active
  setActiveProperties: (propertyIds: string[]) => void;
}

const PropertyFilterContext = createContext<PropertyFilterContextValue | undefined>(undefined);

interface PropertyFilterProviderProps {
  children: ReactNode;
}

/**
 * Property Filter Context Provider
 * 
 * Implements the Property Icon Selection Model:
 * - Default: All properties active (null = all active)
 * - Multi-select filter with smart "all" default
 * - Prevents empty states (auto-corrects to all active)
 */
export function PropertyFilterProvider({ children }: PropertyFilterProviderProps) {
  // null = all properties active (default state)
  // Set<string> = specific properties active
  const [activePropertyIds, setActivePropertyIds] = useState<Set<string> | null>(null);

  const areAllPropertiesActive = activePropertyIds === null;

  const isPropertyActive = (propertyId: string): boolean => {
    if (activePropertyIds === null) {
      return true; // All are active by default
    }
    return activePropertyIds.has(propertyId);
  };

  /**
   * Toggle property selection following the mental model rules:
   * 
   * 1. Clicking a property when ALL are active
   *    → Focus on that one (all others deactivate)
   * 
   * 2. Clicking the ONLY active property
   *    → Return to all active
   * 
   * 3. Clicking an INACTIVE property when one or more are already active
   *    → Add it to active set
   * 
   * 4. Clicking an ACTIVE property when multiple are active
   *    → Remove it (but prevent zero active → auto-correct to all active)
   */
  const toggleProperty = (propertyId: string, allPropertyIds: string[]) => {
    setActivePropertyIds((current) => {
      // Rule 1: All are active → focus on clicked one
      if (current === null) {
        return new Set([propertyId]);
      }

      // Rule 2: Only one active, and it's the clicked one → return to all active
      if (current.size === 1 && current.has(propertyId)) {
        return null; // All active
      }

      // Rule 3: Clicked property is inactive → add it
      if (!current.has(propertyId)) {
        return new Set([...current, propertyId]);
      }

      // Rule 4: Clicked property is active, and multiple are active → remove it
      if (current.size > 1) {
        const newSet = new Set(current);
        newSet.delete(propertyId);
        
        // Constraint: If this would result in zero active, revert to all active
        if (newSet.size === 0) {
          return null; // All active
        }
        
        return newSet;
      }

      // Fallback (shouldn't reach here, but safety)
      return current;
    });
  };

  const resetToAllActive = () => {
    setActivePropertyIds(null);
  };

  const setActiveProperties = (propertyIds: string[]) => {
    if (propertyIds.length === 0) {
      setActivePropertyIds(null); // All active
    } else {
      setActivePropertyIds(new Set(propertyIds));
    }
  };

  const value = useMemo(
    () => ({
      activePropertyIds,
      isPropertyActive,
      areAllPropertiesActive,
      toggleProperty,
      resetToAllActive,
      setActiveProperties,
    }),
    [activePropertyIds]
  );

  return (
    <PropertyFilterContext.Provider value={value}>
      {children}
    </PropertyFilterContext.Provider>
  );
}

/**
 * Hook to use property filter context
 */
export function usePropertyFilter() {
  const context = useContext(PropertyFilterContext);
  if (context === undefined) {
    throw new Error('usePropertyFilter must be used within a PropertyFilterProvider');
  }
  return context;
}
