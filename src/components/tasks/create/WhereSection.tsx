/**
 * WhereSection - Create Task "Where" row with +Property and +Space
 *
 * Row (single-line, scrollable): [ICON] Fact chips… [+ Property] [+ Space/input] Suggestion chips…
 *
 * Behavior:
 * - Clicking `[+ Property]` shows property icon chips inline to the right (no panel below).
 * - While open, the chip label becomes `[Add property]` (opens create-property modal).
 * - Clicking a property icon commits it as a fact chip.
 * - Clicking `[+ Space]` turns it into an inline text input (100→240px). Suggestions appear to the right.
 */

import React, { useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { SemanticChip } from "@/components/chips/semantic";
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog";
import { AddSpaceDialog } from "@/components/spaces/AddSpaceDialog";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useSpaces } from "@/hooks/useSpaces";
import { getAssetIcon } from "@/lib/icon-resolver";

interface SpaceSuggestion {
  id: string;
  label: string;
  blockingRequired?: boolean;
  resolvedEntityId?: string;
}

interface WhereSectionProps {
  propertyId: string;
  selectedPropertyIds: string[];
  selectedSpaceIds: string[];
  onPropertyChange: (propertyIds: string[]) => void;
  onSpacesChange: (spaceIds: string[]) => void;
  /** When true, show selected property/space facts even when not hovered (e.g. modal opened from a specific property context). */
  showFactsByDefault?: boolean;
  /** AI-detected space chips (from rule-based extractor) */
  suggestedChips?: SpaceSuggestion[];
}

export function WhereSection({
  propertyId,
  selectedPropertyIds,
  selectedSpaceIds,
  onPropertyChange,
  onSpacesChange,
  showFactsByDefault = false,
  suggestedChips = [],
}: WhereSectionProps) {
  const { toast } = useToast();
  const { data: properties = [] } = usePropertiesQuery();
  const { spaces, refresh: refreshSpaces } = useSpaces(propertyId || undefined);

  const [isHovered, setIsHovered] = useState(false);
  const [propertyPickerOpen, setPropertyPickerOpen] = useState(false);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [hasExplicitSelection, setHasExplicitSelection] = useState(false);
  const [createdPropertyOverride, setCreatedPropertyOverride] = useState<{
    id: string;
    address: string;
    nickname: string | null;
    icon_name: string;
    icon_color_hex: string;
  } | null>(null);

  const [isSpaceEditing, setIsSpaceEditing] = useState(false);
  const [spaceQuery, setSpaceQuery] = useState("");
  const spaceInputRef = useRef<HTMLInputElement>(null);

  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");

  const selectedProperty =
    properties.find((p: any) => p.id === propertyId) ??
    (createdPropertyOverride?.id === propertyId ? createdPropertyOverride : null);
  const selectedSpaceObjects = selectedSpaceIds
    .map((id) => spaces.find((s) => s.id === id))
    .filter(Boolean) as Array<{ id: string; name: string; icon_name?: string }>;

  const spaceSuggestions = useMemo(() => {
    const q = spaceQuery.trim().toLowerCase();
    if (!q || !propertyId) return [];
    return spaces
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 4);
  }, [spaceQuery, spaces, propertyId]);

  const hasExactSpaceMatch = useMemo(() => {
    const q = spaceQuery.trim().toLowerCase();
    if (!q) return false;
    return spaces.some((s) => s.name.toLowerCase() === q);
  }, [spaceQuery, spaces]);

  const openSpaceInput = () => {
    if (!propertyId) {
      toast({ title: "Choose a property first", variant: "destructive" });
      return;
    }
    setIsSpaceEditing(true);
    setSpaceQuery("");
    setPropertyPickerOpen(false);
    setTimeout(() => spaceInputRef.current?.focus(), 50);
  };

  const commitSpace = (spaceId: string) => {
    if (selectedSpaceIds.includes(spaceId)) return;
    onSpacesChange([...selectedSpaceIds, spaceId]);
    setHasExplicitSelection(true);
    setIsSpaceEditing(false);
    setSpaceQuery("");
  };

  const removeSpace = (spaceId: string) => {
    onSpacesChange(selectedSpaceIds.filter((id) => id !== spaceId));
  };

  const removeProperty = () => {
    onPropertyChange([]);
    onSpacesChange([]);
    setPropertyPickerOpen(false);
    setIsSpaceEditing(false);
    setSpaceQuery("");
  };

  const commitProperty = (id: string) => {
    onPropertyChange([id]);
    onSpacesChange([]); // property change clears spaces
    setPropertyPickerOpen(false);
    setIsSpaceEditing(false);
    setSpaceQuery("");
    setHasExplicitSelection(true);
    if (createdPropertyOverride && createdPropertyOverride.id !== id) {
      setCreatedPropertyOverride(null);
    }
  };

  const handleSpaceCreated = (space: { id: string; name: string; icon_name: string }) => {
    onSpacesChange([...selectedSpaceIds, space.id]);
    setHasExplicitSelection(true);
    setShowCreateSpace(false);
    setNewSpaceName("");
    refreshSpaces();
  };

  const spaceInputWidth = Math.min(240, Math.max(100, (spaceQuery.length + 2) * 8));
  const showFacts = isHovered || showFactsByDefault || hasExplicitSelection;
  const showControls = isHovered || propertyPickerOpen || isSpaceEditing;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setPropertyPickerOpen(false);
        setIsSpaceEditing(false);
        setSpaceQuery("");
      }}
      className={cn(
        "flex flex-col rounded-[8px] transition-all duration-200",
        "hover:bg-muted/30"
      )}
    >
      <div className="flex items-center gap-2 h-[36px] min-w-0">
        <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-[8px] bg-background">
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </div>

        <div
          className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden no-scrollbar"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap pr-[6px]">
          {/* Fact chip: selected property */} 
          {showFacts && selectedProperty && (
            <SemanticChip
              epistemic="fact"
              label={(selectedProperty.nickname || selectedProperty.address || "Property").toUpperCase()}
              icon={(() => {
                const Icon = getAssetIcon(selectedProperty.icon_name || "building");
                return <Icon className="h-3.5 w-3.5 text-white" />;
              })()}
              removable
              onRemove={removeProperty}
              truncate
              className="shrink-0 text-white"
              color={selectedProperty.icon_color_hex || undefined}
            />
          )}

          {/* Fact chips: selected spaces */} 
          {showFacts &&
            selectedSpaceObjects.map((s) => (
              <SemanticChip
                key={s.id}
                epistemic="fact"
                label={s.name.toUpperCase()}
                removable
                onRemove={() => removeSpace(s.id)}
                truncate
                className="shrink-0"
              />
            ))}

          {/* AI-suggested space chips — shown when not editing and no spaces selected */}
          {!isSpaceEditing && selectedSpaceIds.length === 0 &&
            suggestedChips
              .filter(chip => chip.blockingRequired && !chip.resolvedEntityId)
              .map((chip) => (
                <SemanticChip
                  key={chip.id}
                  epistemic="proposal"
                  label={`ADD ${chip.label.toUpperCase()}`}
                  truncate={false}
                  onPress={() => {
                    setNewSpaceName(chip.label);
                    setShowCreateSpace(true);
                  }}
                  className="shrink-0"
                />
              ))
          }

          {/* +Space → input */} 
          {isSpaceEditing ? (
            <>
              <input
                ref={spaceInputRef}
                type="text"
                value={spaceQuery}
                onChange={(e) => setSpaceQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsSpaceEditing(false);
                    setSpaceQuery("");
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const first = spaceSuggestions[0];
                    if (first) commitSpace(first.id);
                    else if (spaceQuery.trim() && !hasExactSpaceMatch) {
                      setNewSpaceName(spaceQuery.trim());
                      setShowCreateSpace(true);
                    }
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setIsSpaceEditing(false);
                    setSpaceQuery("");
                  }, 150);
                }}
                placeholder="+ Space"
                className={cn(
                  "h-[28px] w-[100px] min-w-[100px] max-w-[240px] rounded-[8px] px-2 py-1 shrink-0 flex-shrink-0",
                  "font-mono text-[11px] uppercase tracking-wide",
                  "bg-background text-muted-foreground/70 placeholder:text-muted-foreground/50",
                  "shadow-inset outline-none cursor-text",
                  "transition-[width] duration-150 ease-out"
                )}
                style={{ width: spaceInputWidth }}
              />
              {spaceSuggestions.map((s) => (
                <SemanticChip
                  key={s.id}
                  epistemic="proposal"
                  label={`+${s.name}`.toUpperCase()}
                  onPress={() => commitSpace(s.id)}
                  truncate
                  className="shrink-0"
                />
              ))}
              {spaceQuery.trim() && !hasExactSpaceMatch && (
                <SemanticChip
                  epistemic="proposal"
                  label={`Add ${spaceQuery.trim()}`.toUpperCase()}
                  onPress={() => {
                    setNewSpaceName(spaceQuery.trim());
                    setShowCreateSpace(true);
                  }}
                  truncate
                  className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1"
                />
              )}
            </>
          ) : (
            <>
              {showControls && (
                <>
                  {/* Property control: + Property → icon picker, then becomes Add property */}
                  <SemanticChip
                    epistemic="proposal"
                    label={propertyPickerOpen ? "Add property" : "+ Property"}
                    truncate={false}
                    onPress={() => {
                      if (propertyPickerOpen) {
                        setShowAddProperty(true);
                      } else {
                        setPropertyPickerOpen(true);
                        setIsSpaceEditing(false);
                        setSpaceQuery("");
                      }
                    }}
                    className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1"
                  />

                  {/* Property icons picker (inline, icon-only) */}
                  {propertyPickerOpen &&
                    properties.slice(0, 12).map((p: any) => {
                      const Icon = getAssetIcon(p.icon_name || "building");
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => commitProperty(p.id)}
                          className="h-[28px] w-[28px] rounded-[8px] shrink-0 flex items-center justify-center shadow-e1"
                          style={{ backgroundColor: p.icon_color_hex || "#8EC9CE" }}
                          aria-label={p.nickname || p.address || "Property"}
                        >
                          <Icon className="h-4 w-4 text-white" />
                        </button>
                      );
                    })}

                  {/* Space control */}
                  {!propertyPickerOpen && (
                    <SemanticChip
                      epistemic="proposal"
                      label="+ Space"
                      truncate={false}
                      onPress={openSpaceInput}
                      className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1"
                    />
                  )}
                </>
              )}
            </>
          )}
          </div>
        </div>
      </div>

      <AddPropertyDialog
        open={showAddProperty}
        onOpenChange={(open) => {
          setShowAddProperty(open);
          if (!open) setPropertyPickerOpen(false);
        }}
        onCreated={(p) => {
          setCreatedPropertyOverride(p);
          commitProperty(p.id);
        }}
      />

      <AddSpaceDialog
        open={showCreateSpace}
        onOpenChange={(open) => {
          setShowCreateSpace(open);
          if (!open) setNewSpaceName("");
        }}
        properties={selectedProperty ? [selectedProperty] : properties}
        propertyId={propertyId}
        initialName={newSpaceName}
        onCreated={handleSpaceCreated}
      />
    </div>
  );
}
