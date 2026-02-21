/**
 * Dev Tools Dropdown — Header integration
 *
 * Provides quick access to all dev mode features from any page.
 * Only renders when dev mode is allowed (DEV env or ?dev=true).
 *
 * Production safety: returns null outside dev environments.
 */

import { useCallback } from "react";
import { useDevMode, type DevUserRole } from "@/context/DevModeContext";
import { useQueryClient } from "@tanstack/react-query";
import { useOrgScope } from "@/hooks/useOrgScope";
import { generateCompliancePack } from "@/services/dev/generateCompliancePack";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
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

const ROLES: { value: DevUserRole | null; label: string }[] = [
  { value: null, label: "Real User (no override)" },
  { value: "manager", label: "Manager" },
  { value: "contractor", label: "Contractor" },
  { value: "vendor", label: "Vendor" },
  { value: "admin", label: "Admin" },
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
  if (!import.meta.env.DEV) return null;
  return <DevToolsDropdownInner />;
}

function DevToolsDropdownInner() {
  const devMode = useDevMode();
  const queryClient = useQueryClient();
  const { orgId } = useOrgScope();

  const handleGenerateCompliance = useCallback(async () => {
    if (!orgId) {
      console.warn("[DevTools] No active org — cannot generate compliance pack");
      return;
    }
    try {
      const result = await generateCompliancePack("dev-property", orgId);
      console.log("[DevTools] Compliance pack generated:", result);
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
    } catch (err) {
      console.error("[DevTools] Compliance pack error:", err);
    }
  }, [orgId, queryClient]);

  const handleTimeShift = useCallback(
    (days: number) => {
      devMode.setSimulateTimeShiftDays(days);
      setTimeShiftDays(days);
    },
    [devMode]
  );

  const handleReset = useCallback(() => {
    devMode.reset();
    setTimeShiftDays(0);
  }, [devMode]);

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

      <DropdownMenuContent align="end" className="w-56">
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
            <DropdownMenuSubTrigger>
              <UserCircle className="mr-2 h-4 w-4" />
              Switch User Role
              {devMode.userRoleOverride && (
                <span className="ml-auto text-[10px] font-mono text-teal-600">
                  {devMode.userRoleOverride}
                </span>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {ROLES.map(({ value, label }) => (
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
        </DropdownMenuGroup>

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
