import React from 'react';
import { Surface, Text } from '@/components/filla';
import { Vendor } from '@/hooks/vendor/useVendor';

interface VendorInfoPanelProps {
  vendor: Vendor | null;
}

export const VendorInfoPanel: React.FC<VendorInfoPanelProps> = ({ vendor }) => {
  if (!vendor) return null;

  return (
    <Surface variant="neomorphic" className="p-4 space-y-3">
      <div>
        <Text variant="caption" className="mb-1">Name</Text>
        <Text variant="body">{vendor.name}</Text>
      </div>
      
      <div>
        <Text variant="caption" className="mb-1">Email</Text>
        <Text variant="body">{vendor.email}</Text>
      </div>
      
      <div>
        <Text variant="caption" className="mb-1">Phone</Text>
        <Text variant="body">{vendor.phone}</Text>
      </div>
    </Surface>
  );
};
