import React from "react";

import { PanelSectionTitle } from "@/components/ui/panel-section-title";

/**
 * SectionTitle - Page / column section heading (same visual weight as panel titles).
 */
export const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <PanelSectionTitle as="h2">{children}</PanelSectionTitle>
);
