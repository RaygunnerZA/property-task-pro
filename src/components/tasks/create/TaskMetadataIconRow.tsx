import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, MapPin, Calendar, Box, AlertTriangle, Tag } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AISuggestionChip } from "./AISuggestionChip";
import type { AIExtractResponse } from "@/hooks/useAIExtract";
import fillaAI from "@/assets/filla-ai.svg";

interface TaskMetadataIconRowProps {
  aiResult: AIExtractResponse["combined"] | null;
  activeSection: string | null;
  onSectionClick: (section: string | null) => void;
  onApplyAllSuggestions: () => void;
  // Applied values to show which suggestions are already applied
  appliedPeople?: string[];
  appliedSpaces?: string[];
  appliedDate?: string | null;
  appliedAssets?: string[];
  appliedPriority?: string | null;
  appliedThemes?: string[];
}

const sections = [
  { id: "who", icon: User, label: "Who is responsible", tooltip: "Person / Assignee" },
  { id: "where", icon: MapPin, label: "Where", tooltip: "Property → Space" },
  { id: "when", icon: Calendar, label: "When", tooltip: "Date / Time" },
  { id: "what", icon: Box, label: "What", tooltip: "Asset" },
  { id: "priority", icon: AlertTriangle, label: "Priority", tooltip: "Urgency / Risk" },
  { id: "category", icon: Tag, label: "Category / Type", tooltip: "Maintenance, Inspection, Admin, etc." },
] as const;

/**
 * Format date for display in chip format
 */
function formatDateForChip(dateStr: string | null): string {
  if (!dateStr) return "";
  
  const today = new Date();
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THURS', 'FRI', 'SAT'];
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  
  let date: Date;
  
  if (dateStr === "today") {
    date = new Date(today);
  } else if (dateStr === "tomorrow") {
    date = new Date(today);
    date.setDate(date.getDate() + 1);
  } else if (dateStr === "next_week") {
    date = new Date(today);
    date.setDate(date.getDate() + 7);
  } else if (weekdays.includes(dateStr.toLowerCase())) {
    const targetDay = weekdays.indexOf(dateStr.toLowerCase());
    const currentDay = today.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    date = new Date(today);
    date.setDate(date.getDate() + daysToAdd);
  } else {
    date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr.toUpperCase();
    }
  }
  
  const dayName = dayNames[date.getDay()];
  const monthName = monthNames[date.getMonth()];
  const day = date.getDate();
  
  const hasTime = dateStr.includes('T') && dateStr.includes(':') && !dateStr.endsWith('T00:00:00');
  let timeStr = '';
  if (hasTime) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    timeStr = ` ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  return `${day} ${monthName} | ${dayName}${timeStr}`;
}

export function TaskMetadataIconRow({
  aiResult,
  activeSection,
  onSectionClick,
  onApplyAllSuggestions,
  appliedPeople = [],
  appliedSpaces = [],
  appliedDate = null,
  appliedAssets = [],
  appliedPriority = null,
  appliedThemes = [],
}: TaskMetadataIconRowProps) {
  const hasAnySuggestions = aiResult && (
    (aiResult.people?.length ?? 0) > 0 ||
    (aiResult.spaces?.length ?? 0) > 0 ||
    aiResult.date ||
    (aiResult.assets?.length ?? 0) > 0 ||
    aiResult.priority ||
    (aiResult.themes?.length ?? 0) > 0
  );

  const isApplied = (value: string, appliedItems: string[] | string | null): boolean => {
    if (Array.isArray(appliedItems)) {
      return appliedItems.some(item => item.toLowerCase() === value.toLowerCase());
    }
    return appliedItems?.toLowerCase() === value.toLowerCase();
  };

  // Helper to check if asset is applied (handles ghost IDs)
  const isAssetApplied = (assetName: string): boolean => {
    return appliedAssets.some(id => {
      if (id.startsWith('ghost-asset-')) {
        return id.replace('ghost-asset-', '').toLowerCase() === assetName.toLowerCase();
      }
      // For real asset IDs, we'd need to check against asset names
      // For now, just check ghost IDs
      return false;
    });
  };

  // Get suggestions for each section
  const whoSuggestions = aiResult?.people?.filter(p => !isApplied(p.name, appliedPeople)) || [];
  const whereSuggestions = aiResult?.spaces?.filter(s => !isApplied(s.name, appliedSpaces)) || [];
  const whenSuggestion = aiResult?.date && !isApplied(aiResult.date, appliedDate) ? aiResult.date : null;
  const whatSuggestions = aiResult?.assets?.filter(a => !isAssetApplied(a)) || [];
  const prioritySuggestion = aiResult?.priority && !isApplied(aiResult.priority, appliedPriority) ? aiResult.priority : null;
  const categorySuggestions = aiResult?.themes?.filter(t => !isApplied(t.name, appliedThemes)) || [];

  return (
    <div className="space-y-3">
      {/* Apply All Button */}
      {hasAnySuggestions && (
        <button
          onClick={onApplyAllSuggestions}
          className="flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
        >
          <img src={fillaAI} alt="Filla AI" className="h-3 w-3" />
          TAP TO APPLY FILLA SUGGESTIONS
        </button>
      )}

      {/* Icon Row with AI Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {sections.map((section, index) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          
          // Get suggestions for this section
          let suggestions: Array<{ label: string }> = [];
          if (section.id === "who") {
            suggestions = whoSuggestions.map(p => ({ label: p.name.toUpperCase() }));
          } else if (section.id === "where") {
            suggestions = whereSuggestions.map(s => ({ label: s.name.toUpperCase() }));
          } else if (section.id === "when" && whenSuggestion) {
            suggestions = [{ label: formatDateForChip(whenSuggestion) }];
          } else if (section.id === "what") {
            suggestions = whatSuggestions.map(a => ({ label: a.toUpperCase() }));
          } else if (section.id === "priority" && prioritySuggestion) {
            suggestions = [{ label: prioritySuggestion.toUpperCase() }];
          } else if (section.id === "category") {
            suggestions = categorySuggestions.map(t => ({ label: t.name.toUpperCase() }));
          }

          const hasSuggestions = suggestions.length > 0;

          return (
            <div key={section.id} className="flex items-center">
              {hasSuggestions ? (
                // Group: Icon + Chips with shared hover and border
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onSectionClick(isActive ? null : section.id)}
                        className={cn(
                          "relative inline-flex items-center group transition-all duration-150",
                          "rounded-[5px]",
                          isActive
                            ? "bg-card shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                            : "bg-background shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-[#F6F4F2] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                        )}
                      >
                        {/* Dotted border wrapper (only when not active) */}
                        {!isActive && (
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            style={{ borderRadius: '5px' }}
                          >
                            <rect
                              x="1"
                              y="1"
                              width="calc(100% - 2px)"
                              height="calc(100% - 2px)"
                              rx="5"
                              ry="5"
                              fill="none"
                              stroke="white"
                              strokeWidth="2"
                              strokeDasharray="2 2"
                            />
                          </svg>
                        )}
                        
                        {/* Icon */}
                        <div
                          className={cn(
                            "h-[35px] w-[35px] flex items-center justify-center",
                            "rounded-tl-[5px] rounded-bl-[5px] rounded-tr-none rounded-br-none",
                            "transition-colors duration-150",
                            "bg-transparent"
                          )}
                        >
                          <Icon className={cn(
                            "h-5 w-5 transition-colors duration-150",
                            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                          )} />
                        </div>

                        {/* AI Suggestion Chips */}
                        <div className="flex items-center">
                          {suggestions.map((suggestion, chipIndex) => (
                            <AISuggestionChip
                              key={`${section.id}-${chipIndex}`}
                              label={suggestion.label}
                              selected={isActive}
                              className={chipIndex < suggestions.length - 1 ? "" : "mr-3"}
                            />
                          ))}
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{section.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                // Standalone icon with all corners rounded
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onSectionClick(isActive ? null : section.id)}
                        className={cn(
                          "h-[35px] w-[35px] rounded-[5px] flex items-center justify-center",
                          "transition-all duration-150",
                          isActive
                            ? "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] bg-card"
                            : "shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] bg-background hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] hover:bg-card"
                        )}
                      >
                        <Icon className={cn(
                          "h-5 w-5",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{section.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

