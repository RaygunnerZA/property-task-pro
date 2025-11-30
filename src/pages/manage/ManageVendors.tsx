import { Surface, Heading, Text } from '@/components/filla';
import { Truck } from 'lucide-react';

export default function ManageVendors() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Heading variant="l" className="mb-6">Vendors</Heading>
      
      <Surface variant="neomorphic" className="p-12 text-center">
        <Truck className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-40" />
        <Heading variant="m" className="mb-2">Manage vendors</Heading>
        <Text variant="muted">
          Track suppliers, contractors, and service providers
        </Text>
      </Surface>
    </div>
  );
}
