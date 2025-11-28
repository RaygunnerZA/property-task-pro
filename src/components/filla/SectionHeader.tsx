import React from 'react';
import { Heading } from './Typography';

export interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
}

/**
 * SectionHeader - Consistent page section headers with optional action
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, action }) => (
  <div className="flex justify-between items-end mb-4 px-1 pb-2 border-b border-concrete/50">
    <Heading variant="l" className="text-primary-deep">{title}</Heading>
    {action}
  </div>
);
