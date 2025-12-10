import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChipProps {
  label: string;
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  removable?: boolean;
}

function Chip({ label, selected, onSelect, onRemove, removable }: ChipProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px]',
        'font-mono text-[11px] uppercase tracking-wider font-medium',
        'transition-all duration-200',
        selected
          ? 'bg-primary text-white shadow-e1'
          : 'bg-concrete/50 text-ink/70 hover:bg-concrete'
      )}
    >
      {selected && <Check className="w-3 h-3" />}
      {label}
      {removable && hovered && (
        <X
          className="w-3 h-3 ml-1 cursor-pointer hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
        />
      )}
    </button>
  );
}

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
              <Chip
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
              <Chip
                key={tag}
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
            <span className="inline-flex items-center px-3 py-1.5 rounded-[5px] font-mono text-[11px] uppercase tracking-wider font-medium bg-success/30 text-green-800">
              Compliant
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-[5px] font-mono text-[11px] uppercase tracking-wider font-medium bg-warning/50 text-amber-800">
              Pending
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-[5px] font-mono text-[11px] uppercase tracking-wider font-medium bg-destructive/20 text-red-800">
              Overdue
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-[5px] font-mono text-[11px] uppercase tracking-wider font-medium bg-primary/20 text-primary-deep">
              In Progress
            </span>
          </div>
        </div>

        {/* Priority Chips */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Priority Chips</h3>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-[5px] font-mono text-[10px] uppercase tracking-wider font-medium bg-concrete text-ink/60">
              Low
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-[5px] font-mono text-[10px] uppercase tracking-wider font-medium bg-primary/30 text-primary-deep">
              Normal
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-[5px] font-mono text-[10px] uppercase tracking-wider font-medium bg-accent/20 text-accent">
              High
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
