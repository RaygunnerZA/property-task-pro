import React from 'react';
import { Surface, Heading, Text } from '@/components/filla';

interface VendorDashboardHeaderProps {
  vendorName?: string;
  stats?: {
    assigned: number;
    inProgress: number;
    completed: number;
  };
}

export const VendorDashboardHeader: React.FC<VendorDashboardHeaderProps> = ({ 
  vendorName = 'Vendor',
  stats = { assigned: 0, inProgress: 0, completed: 0 }
}) => {
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <Surface variant="neomorphic" className="p-6">
      <Heading variant="l" className="mb-2">
        Welcome Back, {vendorName}
      </Heading>
      <Text variant="muted" className="mb-4">
        {today}
      </Text>
      
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-accent">{stats.assigned}</div>
          <Text variant="caption">Assigned</Text>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{stats.inProgress}</div>
          <Text variant="caption">In Progress</Text>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-success">{stats.completed}</div>
          <Text variant="caption">Completed</Text>
        </div>
      </div>
    </Surface>
  );
};
