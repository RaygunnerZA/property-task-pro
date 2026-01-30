/**
 * ContextResolver - Reusable panel wrapper for Task Context Panels
 * 
 * Design Constraints:
 * - No heavy borders
 * - No cards
 * - No boxed sections
 * - Spacing, not lines, defines structure
 * - Panels stack vertically
 * - Title/Subtitle rows with inline items and search icon
 * - Search reveals neumorphic pressed input field
 */

import React, { useState } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface SelectedItem {
  id: string;
  label: string;
  onRemove?: () => void;
}

interface ContextResolverProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  helperText?: string;
  children?: React.ReactNode;
  className?: string;
  autoOpen?: boolean;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
  // New props for compact inline layout
  titleItems?: SelectedItem[];
  subtitleItems?: SelectedItem[];
  onTitleAdd?: () => void;
  onSubtitleAdd?: () => void;
}

export const ContextResolver: React.FC<ContextResolverProps> = ({
  title,
  subtitle,
  icon,
  helperText,
  children,
  className,
  autoOpen = false,
  onSearch,
  searchPlaceholder = "Search...",
  titleItems = [],
  subtitleItems = [],
  onTitleAdd,
  onSubtitleAdd
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  // Render a compact row with label, items, and search
  const renderRow = (
    label: string,
    items: SelectedItem[],
    onAdd?: () => void,
    rowIndex: number = 0
  ) => (
    <div className="flex items-center gap-2">
      {/* Label + Add Button */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className={cn(
              'h-5 w-5 rounded-[8px] flex items-center justify-center shrink-0',
              'bg-background shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)]',
              'hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]',
              'transition-all duration-150'
            )}
            aria-label={`Add ${label}`}
          >
            <Plus className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onRemove}
            className={cn(
              'px-2 py-0.5 rounded-[8px] text-xs font-medium shrink-0',
              'bg-card shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]',
              'text-foreground hover:opacity-80',
              'transition-all duration-150'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Search Icon */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Search Input - appears when search icon is clicked */}
        {showSearch && rowIndex === 0 && (
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={cn(
              'w-48 h-[30px] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]',
              'bg-card font-mono text-sm',
              'border-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none'
            )}
            autoFocus
          />
        )}
        {/* Search Icon */}
        <button
          type="button"
          onClick={() => {
            if (rowIndex === 0) {
              setShowSearch(!showSearch);
              if (showSearch) {
                setSearchQuery('');
                onSearch?.('');
              }
            }
          }}
          className={cn(
            'h-[30px] w-[30px] rounded-[8px] flex items-center justify-center shrink-0',
            'transition-all duration-150',
            showSearch && rowIndex === 0
              ? 'bg-card shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]'
              : 'bg-background shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]'
          )}
          aria-label="Search"
        >
          {(showSearch && rowIndex === 0) ? (
            <X className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  );

  // If we have the new compact layout props, use the compact layout
  if (titleItems.length > 0 || subtitleItems.length > 0 || onTitleAdd || onSubtitleAdd) {
    return (
      <div className={cn('space-y-2', className)}>
        {/* Title Row */}
        {renderRow(title, titleItems, onTitleAdd, 0)}
        
        {/* Subtitle Row */}
        {subtitle && renderRow(subtitle, subtitleItems, onSubtitleAdd, 1)}
        
        {/* Helper text (short label) */}
        {helperText && (
          <p className="text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
        
        {/* Content */}
        {children && (
          <div>
            {children}
          </div>
        )}
      </div>
    );
  }

  // Legacy layout for backwards compatibility
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header: Title (descriptive text) */}
      {title && (
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-foreground">{title}</h3>
      </div>
      )}
      
      {/* Content */}
      <div
        ref={(el) => {
          // #region agent log
          if (el) {
            const rect = el.getBoundingClientRect();
            const computed = window.getComputedStyle(el);
            fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContextResolver.tsx:246',message:'Content wrapper width measurement',data:{width:rect.width,padding:computed.padding,margin:computed.margin,parentWidth:el.parentElement?.getBoundingClientRect().width,maxWidth:computed.maxWidth},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
          }
          // #endregion
        }}
      >
        {children}
      </div>
    </div>
  );
};

