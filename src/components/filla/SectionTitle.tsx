import React from 'react';

/**
 * SectionTitle - Simple semantic heading component
 */
export const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-lg font-semibold text-foreground mb-2 tracking-tight">
    {children}
  </h2>
);
