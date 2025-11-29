import React from 'react';
import { SectionHeader } from '@/components/filla';
import { VendorInfoPanel } from '@/components/vendor/VendorInfoPanel';
import { useVendor } from '@/hooks/vendor/useVendor';

export default function VendorProfile() {
  const { vendor, isLoading } = useVendor();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper p-4 flex items-center justify-center">
        <div className="text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper p-4 pb-24 space-y-6">
      <SectionHeader title="Vendor Profile" />
      <VendorInfoPanel vendor={vendor} />
    </div>
  );
}
