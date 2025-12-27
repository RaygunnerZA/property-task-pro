import React from 'react';
import { VendorInfoPanel } from '@/components/vendor/VendorInfoPanel';
import { useVendor } from '@/hooks/vendor/useVendor';
import { StandardPage } from '@/components/design-system/StandardPage';
import { LoadingState } from '@/components/design-system/LoadingState';
import { User } from 'lucide-react';

export default function VendorProfile() {
  const { vendor, isLoading } = useVendor();

  return (
    <StandardPage
      title="Vendor Profile"
      icon={<User className="h-6 w-6" />}
      maxWidth="lg"
    >
      {isLoading ? (
        <LoadingState message="Loading profile..." />
      ) : (
        <VendorInfoPanel vendor={vendor} />
      )}
    </StandardPage>
  );
}
