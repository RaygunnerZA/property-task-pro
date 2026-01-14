import { useState } from "react";
import { User, MapPin, Calendar, Tag, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AIExtractResponse } from "@/hooks/useAIExtract";
import { Chip } from "@/components/chips/Chip";
import fillaAI from "@/assets/filla-ai.svg";

interface AISuggestionStripProps {
  aiResult: AIExtractResponse["combined"];
  onPersonClick?: (person: { name: string; exists: boolean; id?: string }) => void;
  onSpaceClick?: (space: { name: string; exists: boolean; id?: string }) => void;
  onDateClick?: (date: string) => void;
  onThemeClick?: (theme: { name: string; exists: boolean; id?: string; type?: string }) => void;
  onPriorityClick?: (priority: string) => void;
  // Track which items are already applied in the form
  appliedPeople?: string[];
  appliedSpaces?: string[];
  appliedDate?: string | null;
  appliedThemes?: string[];
  appliedPriority?: string | null;
}

/**
 * Format date for display in chip format: "10 JUNE | THURS 12:30"
 * Handles various date formats from AI (today, tomorrow, weekday names, ISO dates)
 */
function formatDateForChip(dateStr: string | null): string {
  if (!dateStr) return "";
  
  // Handle special date strings
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
    // Try to parse as ISO date or other format
    date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // If parsing fails, return the string as-is (uppercase)
      return dateStr.toUpperCase();
    }
  }
  
  // Get day name (THURS)
  const dayName = dayNames[date.getDay()];
  
  // Get month name (JUNE)
  const monthName = monthNames[date.getMonth()];
  const day = date.getDate();
  
  // Format time if available in original string
  const hasTime = dateStr.includes('T') && dateStr.includes(':') && !dateStr.endsWith('T00:00:00');
  let timeStr = '';
  if (hasTime) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    timeStr = ` ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  // Format: "10 JUNE | THURS 12:30"
  return `${day} ${monthName} | ${dayName}${timeStr}`;
}

/**
 * Format space name for display: "MAIN HOUSE | KITCHEN"
 * The space name from AI might already be in this format, or we need to construct it
 */
function formatSpaceName(spaceName: string): string {
  // If already contains "|", return as is (uppercase)
  if (spaceName.includes("|")) {
    return spaceName.toUpperCase();
  }
  // Otherwise, just uppercase it
  return spaceName.toUpperCase();
}

export function AISuggestionStrip({
  aiResult,
  onPersonClick,
  onSpaceClick,
  onDateClick,
  onThemeClick,
  onPriorityClick,
  appliedPeople = [],
  appliedSpaces = [],
  appliedDate = null,
  appliedThemes = [],
  appliedPriority = null,
}: AISuggestionStripProps) {
  // Track which chips have been clicked (for visual feedback)
  const [clickedChips, setClickedChips] = useState<Set<string>>(new Set());

  const handleChipClick = (chipId: string, onClick?: () => void) => {
    setClickedChips((prev) => new Set(prev).add(chipId));
    onClick?.();
  };

  const isApplied = (value: string, appliedItems: string[] | string | null): boolean => {
    if (Array.isArray(appliedItems)) {
      return appliedItems.some(item => item.toLowerCase() === value.toLowerCase());
    }
    return appliedItems?.toLowerCase() === value.toLowerCase();
  };

  // Don't render if no suggestions
  const hasSuggestions =
    (aiResult.people?.length ?? 0) > 0 ||
    (aiResult.spaces?.length ?? 0) > 0 ||
    (aiResult.themes?.length ?? 0) > 0 ||
    aiResult.priority ||
    aiResult.date;

  if (!hasSuggestions) return null;

  return (
    <div className="space-y-2">
      {/* Header - one Filla glyph at row level only */}
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
        <img src={fillaAI} alt="Filla AI" className="h-3 w-3 opacity-70" />
        <span>Filla picked up:</span>
      </div>

      {/* Horizontal scrolling chips */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent -mx-4 px-4">
        <div className="flex gap-2 pb-2">
          {/* People Chips */}
          {(aiResult.people || []).map((person, idx) => {
            const chipId = `person-${person.name}`;
            const applied = isApplied(person.name, appliedPeople) || clickedChips.has(chipId);
            return (
              <Chip
                key={chipId}
                role="suggestion"
                label={person.name.toUpperCase()}
                selected={applied}
                onSelect={() => handleChipClick(chipId, () => onPersonClick?.(person))}
                color={applied ? "#8EC9CE" : undefined}
                animate={true}
                className="shrink-0"
              />
            );
          })}

          {/* Space Chips */}
          {(aiResult.spaces || []).map((space, idx) => {
            const chipId = `space-${space.name}`;
            const applied = isApplied(space.name, appliedSpaces) || clickedChips.has(chipId);
            return (
              <Chip
                key={chipId}
                role="suggestion"
                label={formatSpaceName(space.name)}
                selected={applied}
                onSelect={() => handleChipClick(chipId, () => onSpaceClick?.(space))}
                color={applied ? "#8EC9CE" : undefined}
                animate={true}
                className="shrink-0"
              />
            );
          })}

          {/* Date Chip */}
          {aiResult.date && (
            (() => {
              const chipId = `date-${aiResult.date}`;
              const applied = isApplied(aiResult.date, appliedDate) || clickedChips.has(chipId);
              return (
                <Chip
                  key={chipId}
                  role="suggestion"
                  label={formatDateForChip(aiResult.date)}
                  selected={applied}
                  onSelect={() => handleChipClick(chipId, () => onDateClick?.(aiResult.date!))}
                  color={applied ? "#8EC9CE" : undefined}
                  animate={true}
                  className="shrink-0"
                />
              );
            })()
          )}

          {/* Theme Chips */}
          {(aiResult.themes || []).map((theme, idx) => {
            const chipId = `theme-${theme.name}`;
            const applied = isApplied(theme.name, appliedThemes) || clickedChips.has(chipId);
            return (
              <Chip
                key={chipId}
                role="suggestion"
                label={theme.name.toUpperCase()}
                selected={applied}
                onSelect={() => handleChipClick(chipId, () => onThemeClick?.(theme))}
                color={applied ? "#8EC9CE" : undefined}
                animate={true}
                className="shrink-0"
              />
            );
          })}

          {/* Priority Chip */}
          {aiResult.priority && (
            (() => {
              const priorityUpper = aiResult.priority.toUpperCase();
              const chipId = `priority-${priorityUpper}`;
              const applied = isApplied(priorityUpper, appliedPriority) || clickedChips.has(chipId);
              return (
                <Chip
                  key={chipId}
                  role="suggestion"
                  label={priorityUpper}
                  selected={applied}
                  onSelect={() => handleChipClick(chipId, () => onPriorityClick?.(aiResult.priority!))}
                  color={applied ? "#8EC9CE" : undefined}
                  animate={true}
                  className="shrink-0"
                />
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}

