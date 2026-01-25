/**
 * UnifiedTaskSection - Unified section pattern for all task sections
 * 
 * CHIP ROLE DISTINCTION (RESTORED):
 * - Metadata chips: Resolved entities that persist to task metadata (spaces, themes, assigned users, etc.)
 * - Action chips: Unresolved chips requiring user action (e.g., "INVITE JAMES", "ADD STOVE")
 *   - Action chips must NOT be passed as activeChips
 *   - Action chips must NOT persist to task submission
 *   - Action chips should appear in suggestionChips or verb chips clarity block only
 * 
 * ADD RESOLUTION RULE:
 * - "Add" chips (space/asset with blockingRequired && !resolvedEntityId) are action chips
 * - They must trigger the add flow (open relevant panel/section) when clicked
 * - They must resolve into real entities (spaces/assets) or be explicitly removed
 * - They must never persist as metadata in the submitted task payload
 * 
 * Pattern:
 * - Collapsed: [icon] Section name [Active chips ×] [+]
 * - Expanded: Unified "Add..." input + dropdown (Matches, Recent, Suggested, Actions)
 * - All sections always visible, collapsed by default
 * - Only one section expands at a time
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Chip } from "@/components/chips/Chip";
import { Input } from "@/components/ui/input";

interface DropdownItem {
  id: string;
  label: string;
  type: 'match' | 'recent' | 'suggested' | 'action';
  action?: () => void;
  icon?: React.ReactNode;
}

interface UnifiedTaskSectionProps {
  id: string;
  icon: React.ElementType;
  sectionName: string;
  placeholder: string;
  // Metadata chips only - resolved entities that will persist to task metadata
  // Action chips (unresolved/blocking) must NOT be passed here
  activeChips: Array<{ id: string; label: string; onRemove?: () => void; icon?: React.ReactNode }>;
  // Suggestion chips for unresolved entities requiring action
  suggestionChips?: Array<{ id: string; label: string; onSelect?: () => void }>; // AI suggestion chips with "[Add Frank]" format
  isExpanded: boolean;
  onToggle: () => void;
  dropdownItems: DropdownItem[];
  onItemSelect: (item: DropdownItem) => void;
  blockingMessage?: string; // For unresolved blocking issues
  children?: React.ReactNode; // Custom expanded content (for WHEN section with calendar)
  description?: string; // On-hover description/tooltip for the section
}

export function UnifiedTaskSection({
  id,
  icon: Icon,
  sectionName,
  placeholder,
  activeChips,
  suggestionChips = [],
  isExpanded,
  onToggle,
  dropdownItems,
  onItemSelect,
  blockingMessage,
  children,
  description
}: UnifiedTaskSectionProps) {
  const [inputValue, setInputValue] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasFocusedRef = useRef(false);

  // Reset focus flag when section collapses
  useEffect(() => {
    if (!isExpanded) {
      hasFocusedRef.current = false;
      setInputValue(""); // Clear input when collapsed
      setIsDropdownOpen(false); // Close dropdown when collapsed
    }
  }, [isExpanded]);

  // Focus input when expanded (only once per expansion)  
  useEffect(() => {
    if (isExpanded && inputRef.current && !hasFocusedRef.current) {
      hasFocusedRef.current = true;
      const timeoutId = setTimeout(() => {
        if (inputRef.current && isExpanded) {
          inputRef.current.focus();
        }
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [isExpanded]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Group dropdown items by type - memoize to prevent re-filtering on every render
  const { matches, recent, suggested, actions } = useMemo(() => {
    return {
      matches: dropdownItems.filter(item => item.type === 'match'),
      recent: dropdownItems.filter(item => item.type === 'recent'),
      suggested: dropdownItems.filter(item => item.type === 'suggested'),
      actions: dropdownItems.filter(item => item.type === 'action'),
    };
  }, [dropdownItems]);

  // ROLE FILTER: activeChips should only contain metadata chips (resolved entities)
  // Action chips (unresolved/blocking) must NOT be included in activeChips
  // They should appear in suggestionChips or verb chips clarity block instead
  const hasChips = activeChips.length > 0;

  const handleRowClick = () => {
    onToggle();
  };

  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
  };

  return (
    <div className="w-full mt-1">
      {/* Collapsed Row - Always visible */}
      <div className="flex items-center gap-[6px]">
        {/* Icon - Outside pressed area, left-aligned */}
        <Icon 
          className="h-4 w-4 text-muted-foreground flex-shrink-0" 
          title={description}
        />
        
        {/* Main Clickable Area - Left-aligned content */}
        <button
          type="button"
          onClick={handleRowClick}
          className={cn(
            "flex-1 h-8 flex items-center pl-1 pr-1 pt-1 pb-1 rounded-[5px]",
            "transition-all duration-150",
            "bg-background text-left",
            "hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
          )}
        >
          {/* Metadata Chips (fact role) - Only resolved entities that persist to task metadata */}
          {/* ADD RESOLUTION RULE: "Add" chips (space/asset with blockingRequired && !resolvedEntityId) must NOT appear here */}
          {/* Action chips must NOT appear here - they belong in verb chips clarity block */}
          <div className="flex items-center gap-1.5 flex-nowrap justify-center min-w-0 text-sm">
            {hasChips && activeChips.map(chip => (
              <Chip
                key={chip.id}
                role="fact"
                label={chip.label}
                icon={chip.icon}
                onRemove={chip.onRemove}
                className="shrink-0"
              />
            ))}
            {/* Suggestion chips for unresolved entities (action chips appear here or in verb clarity block) */}
            {suggestionChips.map(chip => (
              <Chip
                key={chip.id}
                role="suggestion"
                label={`Add ${chip.label}`}
                onSelect={chip.onSelect}
                className="shrink-0"
                animate={true}
              />
            ))}
          </div>
        </button>

        {/* Plus Button - Outside main pressed area, right-aligned */}
        <button
          type="button"
          onClick={handlePlusClick}
          className={cn(
            "h-6 w-6 rounded-[5px] flex items-center justify-center flex-shrink-0",
            "bg-background text-muted-foreground",
            "shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)]",
            "hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]",
            "transition-all duration-150"
          )}
        >
          <Plus className="h-[14px] w-[14px]" />
        </button>
      </div>

      {/* Expanded Content - 2-3 lines max */}
      {isExpanded && (
        <div className="mt-1 space-y-2 pl-8">
          {/* Custom content (for WHEN with calendar) or default input */}
          {children ? (
            children
          ) : (
            <>
              {/* Unified Add Input with custom dropdown */}
              <div className="relative">
                <Input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-4 py-2.5 rounded-[5px] bg-input shadow-engraved focus:outline-none focus:ring-2 focus:ring-primary/30 border-0"
                  onFocus={() => setIsDropdownOpen(true)}
                />
                {isDropdownOpen && (
                  <div
                    ref={dropdownRef}
                    className="absolute z-50 w-[300px] mt-1 rounded-md border bg-popover text-popover-foreground shadow-md"
                  >
                    <div className="p-1">
                      <input
                        type="text"
                        placeholder={`Search ${sectionName.toLowerCase()}...`}
                        className="w-full px-2 py-1.5 text-sm rounded-md border bg-background"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {matches.length === 0 && recent.length === 0 && suggested.length === 0 && actions.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No results found.</div>
                      ) : (
                        <>
                          {matches.length > 0 && (
                            <div className="px-2 py-1.5">
                              <div className="text-xs font-semibold text-muted-foreground mb-1">Matches</div>
                              {matches.map(item => (
                                <div
                                  key={item.id}
                                  className="px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent text-sm"
                                  onClick={() => {
                                    onItemSelect(item);
                                    setInputValue("");
                                    setIsDropdownOpen(false);
                                  }}
                                >
                                  {item.icon && <span className="mr-2">{item.icon}</span>}
                                  {item.label}
                                </div>
                              ))}
                            </div>
                          )}

                          {recent.length > 0 && (
                            <div className="px-2 py-1.5">
                              <div className="text-xs font-semibold text-muted-foreground mb-1">Recent</div>
                              {recent.map(item => (
                                <div
                                  key={item.id}
                                  className="px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent text-sm"
                                  onClick={() => {
                                    onItemSelect(item);
                                    setInputValue("");
                                    setIsDropdownOpen(false);
                                  }}
                                >
                                  {item.icon && <span className="mr-2">{item.icon}</span>}
                                  {item.label}
                                </div>
                              ))}
                            </div>
                          )}

                          {suggested.length > 0 && (
                            <div className="px-2 py-1.5">
                              <div className="text-xs font-semibold text-muted-foreground mb-1">Suggested</div>
                              {suggested.map(item => (
                                <div
                                  key={item.id}
                                  className="px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent text-sm"
                                  onClick={() => {
                                    onItemSelect(item);
                                    setInputValue("");
                                    setIsDropdownOpen(false);
                                  }}
                                >
                                  {item.icon && <span className="mr-2">{item.icon}</span>}
                                  {item.label}
                                </div>
                              ))}
                            </div>
                          )}

                          {actions.length > 0 && (
                            <div className="px-2 py-1.5">
                              <div className="text-xs font-semibold text-muted-foreground mb-1">Actions</div>
                              {actions.map(item => (
                                <div
                                  key={item.id}
                                  className="px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent text-sm"
                                  onClick={() => {
                                    onItemSelect(item);
                                    setInputValue("");
                                    setIsDropdownOpen(false);
                                  }}
                                >
                                  {item.icon && <span className="mr-2">{item.icon}</span>}
                                  {item.label}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Blocking Message - If unresolved */}
              {blockingMessage && (
                <p className="text-xs text-muted-foreground px-1">
                  {blockingMessage}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
