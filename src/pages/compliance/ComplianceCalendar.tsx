import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { Calendar } from "@/components/ui/calendar";
import { ComplianceCalendarEvent } from "@/components/compliance/ComplianceCalendarEvent";
import { ComplianceDetailDrawer } from "@/components/compliance/ComplianceDetailDrawer";
import { useComplianceCalendarQuery } from "@/hooks/useComplianceCalendarQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useContractorComplianceQuery } from "@/hooks/useContractorComplianceQuery";
import { useSpaces } from "@/hooks/useSpaces";
import { Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { HAZARD_CATEGORIES, getHazardLabel } from "@/lib/hazards";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ComplianceCalendar() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | undefined>();
  const [selectedContractorId, setSelectedContractorId] = useState<string | undefined>();
  const [selectedExpiryState, setSelectedExpiryState] = useState<string | undefined>();
  const [selectedHazard, setSelectedHazard] = useState<string | undefined>();
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | undefined>();
  const [selectedAiConfidence, setSelectedAiConfidence] = useState<string | undefined>();
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const rangeStart = startOfMonth(selectedDate);
  const rangeEnd = endOfMonth(selectedDate);

  const filters = useMemo(
    () => ({
      propertyId: selectedPropertyId,
      contractorOrgId: selectedContractorId,
      expiryState: selectedExpiryState,
      hazard: selectedHazard,
      spaceId: selectedSpaceId,
      aiConfidenceMin:
        selectedAiConfidence === "high"
          ? 0.8
          : selectedAiConfidence === "medium"
          ? 0.5
          : undefined,
    }),
    [
      selectedPropertyId,
      selectedContractorId,
      selectedExpiryState,
      selectedHazard,
      selectedSpaceId,
      selectedAiConfidence,
    ]
  );

  const { data: events = [], isLoading } = useComplianceCalendarQuery(rangeStart, rangeEnd, filters);
  const { data: properties = [] } = usePropertiesQuery();
  const { data: contractorItems = [] } = useContractorComplianceQuery();
  const { spaces = [] } = useSpaces();

  const byDate = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) {
      const key = e.next_due_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const contractorIds = useMemo(() => {
    const ids = new Set(contractorItems.map((c) => c.contractor_org_id));
    return Array.from(ids);
  }, [contractorItems]);

  const contractorNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contractorItems) {
      map.set(c.contractor_org_id, c.contractor_name);
    }
    return map;
  }, [contractorItems]);

  const handleEventClick = (event: any) => {
    setSelectedEvent(event);
    setDrawerOpen(true);
  };

  const selectedDateEvents = byDate.get(format(selectedDate, "yyyy-MM-dd")) || [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
              className="p-2 rounded-lg hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-medium min-w-[140px] text-center">
              {format(selectedDate, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
              className="p-2 rounded-lg hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Select value={selectedPropertyId ?? "all"} onValueChange={(v) => setSelectedPropertyId(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Property" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All properties</SelectItem>
              {properties.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nickname || p.address || "Unnamed"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedContractorId ?? "all"} onValueChange={(v) => setSelectedContractorId(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Contractor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All contractors</SelectItem>
              {contractorIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {contractorNames.get(id) || "Unknown"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedExpiryState ?? "all"} onValueChange={(v) => setSelectedExpiryState(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="expiring">Expiring</SelectItem>
              <SelectItem value="valid">Valid</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedHazard ?? "all"} onValueChange={(v) => setSelectedHazard(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Hazard" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All hazards</SelectItem>
              {HAZARD_CATEGORIES.map((h) => (
                <SelectItem key={h} value={h}>
                  {getHazardLabel(h)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSpaceId ?? "all"} onValueChange={(v) => setSelectedSpaceId(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Space" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All spaces</SelectItem>
              {spaces.map((s: { id: string; name?: string | null }) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name || "Unnamed"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedAiConfidence ?? "all"} onValueChange={(v) => setSelectedAiConfidence(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="AI confidence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All confidence</SelectItem>
              <SelectItem value="high">High (≥80%)</SelectItem>
              <SelectItem value="medium">Medium (≥50%)</SelectItem>
            </SelectContent>
          </Select>
      </div>

      {/* Calendar + Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg bg-card p-4 shadow-e1">
            {isLoading ? (
              <LoadingState message="Loading calendar..." />
            ) : (
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                month={selectedDate}
                onMonthChange={setSelectedDate}
              />
            )}
          </div>
          <div className="rounded-lg bg-card p-4 shadow-e1">
            <h3 className="font-semibold text-foreground mb-3">
              {format(selectedDate, "MMMM d, yyyy")}
            </h3>
            {selectedDateEvents.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="No compliance due"
                description="No compliance items due on this date"
              />
            ) : (
              <div className="space-y-2">
                {selectedDateEvents.map((e) => (
                  <ComplianceCalendarEvent
                    key={e.id}
                    title={e.title}
                    propertyName={e.property_name}
                    expiryState={e.expiry_state}
                    hazards={e.hazards}
                    aiConfidence={e.ai_confidence}
                    onClick={() => handleEventClick(e)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

      <ComplianceDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        compliance={selectedEvent}
      />
    </div>
  );
}
