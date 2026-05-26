import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/design-system/PageHeader";
import { WorkbenchHeaderToolbar } from "@/components/dashboard/WorkbenchHeaderToolbar";

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
        className="relative flex h-[80px] items-start rounded-bl-[12px] px-[18px] pt-0 pr-28 sm:pr-40"
        style={headerStyle}
      >
        {showTodayWeather ? (
          <div className="flex w-[248px] min-w-0 shrink-0 items-start justify-start gap-[7px] pt-[25px]">
            <h1 className="shrink-0 text-[18px] font-semibold leading-tight text-white">Today</h1>
            <div className="mx-2 h-6 w-px shrink-0 bg-white/30" />
            <div className="flex items-center justify-start gap-2 text-left">
              <WeatherIcon className="h-4 w-4 shrink-0 text-white/90" />
              <span className="whitespace-nowrap text-sm text-white/90">
                {weather ? `${weather.temp}°C` : "--°C"}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-[248px] shrink-0" aria-hidden />
        )}

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[min(calc(100%-11rem),720px)] -translate-x-1/2 -translate-y-1/2 pt-5 sm:w-[min(calc(100%-14rem),720px)]">
          <WorkbenchHeaderToolbar
            variant="gradient"
            className="pointer-events-auto"
            properties={properties}
            onAskFilla={onAskFilla}
          />
        </div>
      </div>
    </PageHeader>
  );
}
