import React, { useState } from 'react';
import { FilterChip } from '@/components/chips/filter';
import { SemanticChip } from '@/components/chips/semantic';

export function ChipsSection() {
  const [selectedFilters, setSelectedFilters] = useState<string[]>(['All']);
  const [tags, setTags] = useState(['Urgent', 'Compliance', 'Maintenance', 'Review']);

  const filters = ['All', 'Today', 'This Week', 'Overdue', 'High Priority'];

  const toggleFilter = (filter: string) => {
    if (filter === 'All') {
      setSelectedFilters(['All']);
    } else {
      const newFilters = selectedFilters.includes(filter)
        ? selectedFilters.filter((f) => f !== filter)
        : [...selectedFilters.filter((f) => f !== 'All'), filter];
      setSelectedFilters(newFilters.length ? newFilters : ['All']);
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight heading-l">Chips</h2>
        <p className="text-muted-foreground text-sm">JetBrains Mono ALL CAPS for filter and tag chips</p>
      </div>

      <div className="space-y-6">
        {/* Filter Chips */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Filter Chips (Selectable)</h3>
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <FilterChip
                key={filter}
                label={filter}
                selected={selectedFilters.includes(filter)}
                onSelect={() => toggleFilter(filter)}
              />
            ))}
          </div>
        </div>

        {/* Removable Tags */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Removable Tags (hover to reveal X)</h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <SemanticChip
                key={tag}
                epistemic="fact"
                label={tag}
                removable
                onRemove={() => removeTag(tag)}
              />
            ))}
          </div>
        </div>

        {/* Status Chips */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status Chips</h3>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center px-3 py-1.5 rounded-[8px] font-mono text-[11px] uppercase tracking-wider font-medium bg-success/30 text-green-800 shadow-e1">
              Compliant
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-[8px] font-mono text-[11px] uppercase tracking-wider font-medium bg-warning/50 text-amber-800 shadow-e1">
              Pending
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-[8px] font-mono text-[11px] uppercase tracking-wider font-medium bg-destructive/20 text-red-800 shadow-e1">
              Overdue
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-[8px] font-mono text-[11px] uppercase tracking-wider font-medium bg-primary/20 text-primary-deep shadow-e1">
              In Progress
            </span>
          </div>
        </div>

        {/* Priority Chips */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Priority Chips</h3>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-[8px] font-mono text-[10px] uppercase tracking-wider font-medium bg-concrete text-ink/60 shadow-e1">
              Low
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-[8px] font-mono text-[10px] uppercase tracking-wider font-medium bg-primary/30 text-primary-deep shadow-e1">
              Normal
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-[8px] font-mono text-[10px] uppercase tracking-wider font-medium bg-accent/20 text-accent shadow-e1">
              High
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
