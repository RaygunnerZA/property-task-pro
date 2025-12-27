import { Truck } from 'lucide-react';
import { StandardPage } from '@/components/design-system/StandardPage';
import { EmptyState } from '@/components/design-system/EmptyState';

export default function ManageVendors() {
  return (
    <StandardPage
      title="Vendors"
      icon={<Truck className="h-6 w-6" />}
      maxWidth="lg"
    >
      <EmptyState
        icon={Truck}
        title="Manage vendors"
        description="Track suppliers, contractors, and service providers"
      />
    </StandardPage>
  );
}
