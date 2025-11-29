import { useState, useEffect } from 'react';

export interface Vendor {
  id: string;
  org_id: string;
  name: string;
  email: string;
  phone: string;
}

/**
 * Stub hook for vendor profile data
 * Returns placeholder vendor information
 */
export const useVendor = (vendorId?: string) => {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setVendor({
        id: vendorId || 'vendor-1',
        org_id: 'org-1',
        name: 'ABC Maintenance Co.',
        email: 'contact@abcmaintenance.com',
        phone: '555-0123'
      });
      setIsLoading(false);
    }, 300);
  }, [vendorId]);

  return { vendor, isLoading };
};
