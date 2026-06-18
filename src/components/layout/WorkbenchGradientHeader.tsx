import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/design-system/PageHeader";
import { WorkbenchHeaderToolbar } from "@/components/dashboard/WorkbenchHeaderToolbar";
import { cn } from "@/lib/utils";

/** Gradient strip: colour solid until ~28%, then fades to transparent. */
export function createGradientHeaderStyle(color: string): CSSProperties {
  return {
    backgroundImage: `linear-gradient(90deg, ${color} 0%, ${color} 28%, transparent 97%, transparent 100%)`,
  };
}

export type WorkbenchGradientHeaderProps = {
  headerStyle: CSSProperties;
  showTodayWeather?: boolean;
  WeatherIcon: LucideIcon;
  weather: { temp?: number } | null | undefined;
  properties: {
    id: string;
    name?: string | null;
    nickname?: string | null;
    address?: string | null;
  }[];
  onAskFilla?: (query: string) => void;
};

export function WorkbenchGradientHeader({
  headerStyle,
  showTodayWeather = true,
  WeatherIcon,
  weather,
  properties,
  onAskFilla,
}: WorkbenchGradientHeaderProps) {
  return (
    <PageHeader showAccountMenu={false}>
      <div
        className={cn(
          "grid h-[80px] w-full min-w-0 items-start rounded-bl-[12px] pr-28 sm:pr-40",
          /* Match DualPaneLayout: mobile-width side rails | center column (700px at layout+) */
          "grid-cols-1",
          "sm:grid-cols-workbench-dual",
          "layout:grid-cols-workbench-triple"
        )}
        style={headerStyle}
      >
        <div
          className={cn(
            "hidden min-w-0 items-start justify-start gap-[7px] px-[18px] pt-[25px] sm:flex",
            !showTodayWeather && "sm:invisible"
          )}
        >
          {showTodayWeather ? (
            <>
              <h1 className="shrink-0 text-[18px] font-semibold leading-tight text-white">Today</h1>
              <div className="mx-2 h-6 w-px shrink-0 bg-white/30" />
              <div className="flex items-center justify-start gap-2 text-left">
                <WeatherIcon className="h-4 w-4 shrink-0 text-white/90" />
                <span className="whitespace-nowrap text-sm text-white/90">
                  {weather ? `${weather.temp}°C` : "--°C"}
                </span>
              </div>
            </>
          ) : null}
        </div>

        <div
          className={cn(
            "flex min-w-0 items-start px-3 pt-5 sm:col-start-2 sm:px-1 sm:max-w-[700px]",
            "layout:max-w-[700px]"
          )}
        >
          <WorkbenchHeaderToolbar
            variant="gradient"
            className="w-full min-w-0"
            properties={properties}
            onAskFilla={onAskFilla}
          />
        </div>

        <div className="hidden min-w-0 layout:block" aria-hidden />
      </div>
    </PageHeader>
  );
}
