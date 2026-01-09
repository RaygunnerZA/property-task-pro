/**
 * CategoryPanel - Task Context Resolver for categories/themes
 */

import React, { useState } from 'react';
import { Tag, Plus } from 'lucide-react';
import { ContextResolver } from '../ContextResolver';
import { StandardChip } from '@/components/chips/StandardChip';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

interface CategoryPanelProps {
  selectedThemeIds: string[];
  onThemesChange: (themeIds: string[]) => void;
  suggestedThemes?: Array<{ name: string; type: string }>;
}

export function CategoryPanel({
  selectedThemeIds,
  onThemesChange,
  suggestedThemes = []
}: CategoryPanelProps) {
  const { categories } = useCategories();

  const filteredCategories = categories;

  const toggleCategory = (categoryId: string) => {
    if (selectedThemeIds.includes(categoryId)) {
      onThemesChange(selectedThemeIds.filter(id => id !== categoryId));
    } else {
      onThemesChange([...selectedThemeIds, categoryId]);
    }
  };

  return (
    <ContextResolver
      title=""
      helperText=""
    >
        <div className="flex items-center gap-2 w-full min-w-0">
          {/* CATEGORY + chip - Fixed on left */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 pl-[9px] pr-1.5 py-1.5 rounded-[8px] h-[29px] bg-background text-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] shrink-0 font-mono transition-all duration-150 cursor-pointer"
          >
            <span className="text-[12px] uppercase leading-[16px]">CATEGORY</span>
            <Plus className="h-3.5 w-3.5" />
          </button>
          
          {/* Scrollable middle section with category chips */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden min-w-0 no-scrollbar">
            <div className="flex items-center gap-2 h-[40px]">
              {filteredCategories.length > 0 ? (
                filteredCategories.map(category => (
                  <StandardChip
                    key={category.id}
                    label={category.name}
                    selected={selectedThemeIds.includes(category.id)}
                    onSelect={() => toggleCategory(category.id)}
                    className="shrink-0"
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  No categories yet
                </p>
              )}
            </div>
          </div>
        </div>
    </ContextResolver>
  );
}

