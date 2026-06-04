/**
 * Dev Tools Dropdown — Header integration
 *
 * Provides quick access to all dev mode features from any page.
 * Renders when isDevBuild (local dev or VITE_APP_DEV_BUILD=true deployment).
 */

import { useCallback, useState } from "react";
import { useDevMode } from "@/context/useDevMode";
import { isDevBuild } from "@/context/DevModeContext";
import type { DevUserRole } from "@/context/DevModeContext";
import { useQueryClient } from "@tanstack/react-query";
import { useOrgScope } from "@/hooks/useOrgScope";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { generateCompliancePack } from "@/services/dev/generateCompliancePack";
import { seedRolePlayScenario } from "@/services/dev/seedRolePlayScenario";
import {
  ensureTestPersonasInOrg,
  EnsureTestPersonasError,
} from "@/services/dev/ensureTestPersonasInOrg";
import {
  SwitchTestPersonaError,
  switchTestPersona,
} from "@/services/dev/switchTestPersona";
import { TEST_PERSONAS } from "@/lib/dev/testPersonas";
import { setTimeShiftDays } from "@/services/dev/devTime";
import {
  Wrench,
  UserCircle,
  ShieldCheck,
  Clock,
  Wifi,
  WifiOff,
  Brain,
  Package,
  RotateCcw,
  Check,
  MonitorSmartphone,
  Users,
  MessageSquare,
  Loader2,
  Radio,
} from "lucide-react";
import { useDevEmbedLayout } from "@/hooks/useDevEmbedLayout";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SignalDiagnosticsPanel } from "@/components/dev/SignalDiagnosticsPanel";

const UI_ROLE_OVERRIDES: { value: DevUserRole | null; label: string }[] = [
  { value: null, label: "Use real membership role" },
  { value: "manager", label: "UI: Manager" },
  { value: "contractor", label: "UI: Contractor" },
  { value: "vendor", label: "UI: Vendor" },
  { value: "admin", label: "UI: Admin" },
];

const TIME_SHIFTS: { days: number; label: string }[] = [
  { days: 0, label: "No shift (real time)" },
  { days: 30, label: "+30 days" },
  { days: 60, label: "+60 days" },
  { days: 90, label: "+90 days" },
  { days: 180, label: "+180 days" },
  { days: 365, label: "+365 days" },
];

export function DevToolsDropdown() {
  if (!isDevBuild) return null;
  return <DevToolsDropdownInner />;
}

function DevToolsDropdownInner() {
  const devEmbed = useDevEmbedLayout();
  const devMode = useDevMode();
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { orgId } = useOrgScope();
  const [switchingPersona, setSwitchingPersona] = useState(false);
  const [linkingPersonas, setLinkingPersonas] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleGenerateCompliance = useCallback(async () => {
    if (!orgId) {
      console.warn("[DevTools] No active org — cannot generate compliance pack");
      return;
    }
    const propertyId = prompt("Enter a property ID to seed compliance data for:");
    if (!propertyId?.trim()) return;
    try {
      await generateCompliancePack(propertyId.trim(), orgId);
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
    } catch (err) {
      console.error("[DevTools] Compliance pack error:", err);
    }
  }, [orgId, queryClient]);

  const handleTimeShift = useCallback(
    (days: number) => {
      devMode.setSimulateTimeShiftDays(days);
      setTimeShiftDays(days);
      if (!devMode.enabled && days > 0) devMode.setEnabled(true);
    },
    [devMode]
  );

  const handleReset = useCallback(() => {
    devMode.reset();
    setTimeShiftDays(0);
  }, [devMode]);

  const handleLinkTestUsers = useCallback(async () => {
    if (!orgId) {
      toast.error("No active org — open your workbench organisation first.");
      return;
    }
    setLinkingPersonas(true);
    try {
      const result = await ensureTestPersonasInOrg(supabase, orgId);
      if (result.missing.length > 0) {
        toast.warning(
          `Linked ${result.added} new, updated ${result.updated}. Missing accounts: run node scripts/create-test-users.js`
        );
      } else {
        toast.success(
          `Test users linked to this org (${result.added} added, ${result.updated} roles updated)`
        );
      }
    } catch (err) {
      toast.error(
        err instanceof EnsureTestPersonasError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not link test users"
      );
    } finally {
      setLinkingPersonas(false);
    }
  }, [orgId, supabase]);

  const handleSwitchPersona = useCallback(
    async (personaId: (typeof TEST_PERSONAS)[number]["id"] | null) => {
      if (personaId && !orgId) {
        toast.error("No active org — open your workbench organisation first.");
        return;
      }
      setSwitchingPersona(true);
      try {
        await switchTestPersona(supabase, queryClient, personaId, { orgId: orgId ?? undefined });
      } catch (err) {
        const message =
          err instanceof SwitchTestPersonaError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not switch test user";
        toast.error(message);
        setSwitchingPersona(false);
      }
    },
    [supabase, queryClient, orgId]
  );

  const handleSeedRolePlay = useCallback(async () => {
    if (!orgId) {
      toast.error("No active org — sign in and select an organisation first.");
      return;
    }
    setSeeding(true);
    try {
      const result = await seedRolePlayScenario(supabase, orgId);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks-briefing"] });
      void queryClient.invalidateQueries({ queryKey: ["messages"] });

      if (result.missingPersonas.length > 0) {
        toast.warning(
          `Scenario ${result.created ? "created" : "already exists"}, but some test users are not in this org. Use “Link test users to this org” first.`
        );
      } else if (result.created) {
        toast.success(
          `Role-play seeded: ${result.tasksCreated} tasks, ${result.messagesCreated} messages`
        );
      } else {
        toast.info("Role-play scenario already exists for this org");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  }, [orgId, supabase, queryClient]);

  if (devEmbed) return null;

  const activePersona = TEST_PERSONAS.find((p) => p.id === devMode.activeTestPersonaId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
            devMode.enabled
              ? "bg-teal-100 text-teal-800 shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
        >
          <Wrench className="h-3.5 w-3.5" />
          Dev Tools
          {devMode.enabled && (
            <span className="ml-1 w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">
          Development Tools
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => devMode.toggle()}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            {devMode.enabled ? "Disable" : "Enable"} Dev Mode
            {devMode.enabled && (
              <Check className="ml-auto h-3.5 w-3.5 text-teal-600" />
            )}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={switchingPersona}>
              <Users className="mr-2 h-4 w-4" />
              Switch test user
              {switchingPersona ? (
                <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" />
              ) : activePersona ? (
                <span className="ml-auto text-[10px] font-mono text-teal-600">
                  {activePersona.testId}
                </span>
              ) : null}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-72">
              <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">
                Adds TEST users to your current org, then signs in. Password:
                TestPassword123! (or VITE_DEV_TEST_PASSWORD)
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => void handleSwitchPersona(null)}
                disabled={switchingPersona}
              >
                Stay on current session
                {!devMode.activeTestPersonaId && (
                  <Check className="ml-auto h-3.5 w-3.5 text-teal-600" />
                )}
              </DropdownMenuItem>
              {TEST_PERSONAS.map((persona) => (
                <DropdownMenuItem
                  key={persona.id}
                  onClick={() => void handleSwitchPersona(persona.id)}
                  disabled={switchingPersona}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="font-mono text-[10px] text-teal-700">
                      {persona.testId}
                    </span>
                    <span className="font-medium">{persona.label}</span>
                    {devMode.activeTestPersonaId === persona.id && (
                      <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-teal-600" />
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground pl-12">
                    {persona.membershipRole}
                    {persona.uiRoleOverride ? ` · UI ${persona.uiRoleOverride}` : ""}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <UserCircle className="mr-2 h-4 w-4" />
              UI role override
              {devMode.userRoleOverride && (
                <span className="ml-auto text-[10px] font-mono text-teal-600">
                  {devMode.userRoleOverride}
                </span>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {UI_ROLE_OVERRIDES.map(({ value, label }) => (
                <DropdownMenuItem
                  key={label}
                  onClick={() => {
                    devMode.setUserRoleOverride(value);
                    if (!devMode.enabled && value) devMode.setEnabled(true);
                  }}
                >
                  {label}
                  {devMode.userRoleOverride === value && (
                    <Check className="ml-auto h-3.5 w-3.5 text-teal-600" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem
            onClick={() => void handleLinkTestUsers()}
            disabled={linkingPersonas || !orgId}
          >
            {linkingPersonas ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Users className="mr-2 h-4 w-4" />
            )}
            Link test users to this org
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => void handleSeedRolePlay()} disabled={seeding}>
            {seeding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MessageSquare className="mr-2 h-4 w-4" />
            )}
            Seed role-play scenario
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Clock className="mr-2 h-4 w-4" />
              Simulate Time
              {devMode.simulateTimeShiftDays > 0 && (
                <span className="ml-auto text-[10px] font-mono text-teal-600">
                  +{devMode.simulateTimeShiftDays}d
                </span>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {TIME_SHIFTS.map(({ days, label }) => (
                <DropdownMenuItem
                  key={days}
                  onClick={() => handleTimeShift(days)}
                >
                  {label}
                  {devMode.simulateTimeShiftDays === days && (
                    <Check className="ml-auto h-3.5 w-3.5 text-teal-600" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handleGenerateCompliance}>
            <Package className="mr-2 h-4 w-4" />
            Generate Compliance Pack
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              devMode.setSimulateSlowNetwork(!devMode.simulateSlowNetwork);
              if (!devMode.enabled) devMode.setEnabled(true);
            }}
          >
            {devMode.simulateSlowNetwork ? (
              <WifiOff className="mr-2 h-4 w-4 text-amber-600" />
            ) : (
              <Wifi className="mr-2 h-4 w-4" />
            )}
            Simulate Slow Network
            {devMode.simulateSlowNetwork && (
              <Check className="ml-auto h-3.5 w-3.5 text-teal-600" />
            )}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              devMode.setShowAIDebugPanel(!devMode.showAIDebugPanel);
              if (!devMode.enabled) devMode.setEnabled(true);
            }}
          >
            <Brain className="mr-2 h-4 w-4" />
            {devMode.showAIDebugPanel ? "Hide" : "Open"} AI Debug Panel
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              devMode.setShowViewportSimulator(!devMode.showViewportSimulator);
              if (!devMode.enabled) devMode.setEnabled(true);
            }}
          >
            <MonitorSmartphone className="mr-2 h-4 w-4" />
            {devMode.showViewportSimulator ? "Hide" : "Open"} viewport simulator
            {devMode.showViewportSimulator && (
              <Check className="ml-auto h-3.5 w-3.5 text-teal-600" />
            )}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Radio className="mr-2 h-4 w-4" />
            Signal Diagnostics
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="p-0" sideOffset={4}>
            <SignalDiagnosticsPanel />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset All Dev Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default DevToolsDropdown;
