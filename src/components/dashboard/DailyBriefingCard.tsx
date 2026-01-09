import { useState, useEffect } from "react";
import { useDailyBriefing } from "@/hooks/use-daily-briefing";
import { Target, AlertCircle, Building2, Repeat, Cloud, CloudRain, Sun, CloudSun, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyBriefingCardProps {
  showGreeting?: boolean;
}

/**
 * Daily Briefing Card Component
 * 
 * Two states:
 * - Welcome (Expanded): Greeting + Weather on left, 4 items in 2x2 grid on right
 * - Compressed: Weather + 4 items in single horizontal row
 * 
 * Auto-transitions from Welcome to Compressed after 30 seconds
 * Manual trigger via hide icon (top left corner)
 */
export function DailyBriefingCard({ showGreeting = true }: DailyBriefingCardProps) {
  const { greeting, focus, insight, context, reminder, weather, loading } = useDailyBriefing();
  const [isCompressed, setIsCompressed] = useState(false);
  const [isManuallyTriggered, setIsManuallyTriggered] = useState(false);

  // Trigger compression after 30 seconds (only if not manually triggered)
  useEffect(() => {
    if (!showGreeting || isCompressed || isManuallyTriggered) return;

    const compressionTimer = setTimeout(() => {
      setIsCompressed(true);
    }, 30000); // 30 seconds

    return () => clearTimeout(compressionTimer);
  }, [showGreeting, isCompressed, isManuallyTriggered]);

  // Manual trigger for compression
  const handleHide = () => {
    setIsManuallyTriggered(true);
    setIsCompressed(true);
  };

  // Get weather icon based on condition code
  const getWeatherIcon = (conditionCode: number | null) => {
    if (!conditionCode) return Cloud;
    
    // WMO Weather interpretation codes (simplified)
    // 0: Clear sky, 1-3: Mainly clear/partly cloudy, 45-48: Fog
    // 51-67: Drizzle/Rain, 71-77: Snow, 80-99: Rain showers/Thunderstorm
    if (conditionCode === 0) return Sun;
    if (conditionCode >= 1 && conditionCode <= 3) return CloudSun;
    if (conditionCode >= 51 && conditionCode <= 67) return CloudRain;
    if (conditionCode >= 80 && conditionCode <= 99) return CloudRain;
    return Cloud;
  };

  const WeatherIcon = weather ? getWeatherIcon(weather.conditionCode) : Cloud;

  const infoItems = [
    {
      label: "Focus",
      value: focus,
      icon: Target,
      color: "text-primary",
      bgColor: "bg-primary/20",
      borderColor: "border-primary/40",
      index: 0,
    },
    {
      label: "Insight",
      value: insight ? "!" : null,
      icon: AlertCircle,
      color: insight ? "text-accent" : "text-muted-foreground",
      bgColor: insight ? "bg-accent/20" : "bg-muted/30",
      borderColor: insight ? "border-accent/40" : "border-border/30",
      text: insight,
      index: 1,
    },
    {
      label: "Context",
      value: context ? "•" : null,
      icon: Building2,
      color: context ? "text-primary" : "text-muted-foreground",
      bgColor: context ? "bg-primary/20" : "bg-muted/30",
      borderColor: context ? "border-primary/40" : "border-border/30",
      text: context,
      index: 2,
    },
    {
      label: "Reminder",
      value: reminder,
      icon: Repeat,
      color: "text-primary",
      bgColor: "bg-primary/20",
      borderColor: "border-primary/40",
      index: 3,
    },
  ];

  if (loading) {
    return (
      <div className="rounded-xl p-6 bg-surface-gradient shadow-e1 animate-pulse">
        <div className="h-24 bg-muted/50 rounded-lg" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl bg-surface-gradient shadow-e1 w-full max-w-full border border-primary/30 overflow-hidden relative",
        isCompressed ? "p-4 md:px-[25px] md:py-4" : "p-4 md:px-[25px] md:py-6"
      )}
      style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(239, 238, 235, 1) 50%, rgba(234, 233, 230, 1) 100%)' }}
    >
      {/* Hide Icon Button - Top Left Corner */}
      {!isCompressed && (
        <button
          onClick={handleHide}
          className="absolute top-3 left-3 z-20 p-1.5 rounded-lg bg-background/80 backdrop-blur-sm border border-border/50 shadow-e1 hover:shadow-e2 hover:bg-card transition-all duration-150"
          aria-label="Hide briefing card"
        >
          <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      )}

      {isCompressed ? (
          /* Compressed State: Single Row */
          <div
            key="compressed"
            className="flex items-center gap-3 md:gap-4 w-full"
          >
            {/* Weather Panel - Leftmost */}
            <div
              className="flex items-center gap-3 flex-shrink-0 px-3 py-2 rounded-2xl bg-primary/20 border border-primary/40"
            >
              <WeatherIcon className="h-5 w-5 md:h-6 md:w-6 text-primary flex-shrink-0" />
              <span className="text-base md:text-lg font-medium text-primary whitespace-nowrap">
                {weather ? `${weather.temp}°C` : "--°C"}
              </span>
            </div>

            {/* 4 Info Items - Horizontal Row */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 min-w-0">
              {infoItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={cn(
                      "rounded-3xl px-2.5 py-2.5 flex items-start gap-2 md:gap-3",
                      item.bgColor,
                      "shadow-sm border",
                      item.borderColor,
                      "transition-all duration-150 hover:shadow-md hover:scale-[1.02]",
                      "min-w-0"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 md:h-5 md:w-5 flex-shrink-0 mt-0.5", item.color)} />
                    <div className="flex-1 min-w-0">
                      {item.text ? (
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5 truncate">
                            {item.label}
                          </p>
                          <p className="text-sm font-semibold text-foreground leading-[18px] line-clamp-2 break-words">
                            {item.text}
                          </p>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5 truncate">
                            {item.label}
                          </p>
                          <p className={cn("text-base md:text-lg font-bold truncate", item.color)}>
                            {item.value}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Welcome State: Expanded */
          <div
            className={cn("flex flex-col", showGreeting ? "md:flex-row gap-4 md:gap-6 w-full" : "w-full")}
          >
            {showGreeting && (
              <div
                className="flex-shrink-0 md:w-[30%] flex flex-col justify-between min-w-0 w-full"
              >
                <div className="min-w-0 w-full">
                  <h2 className="text-xl md:text-2xl font-semibold bg-gradient-to-r from-primary via-primary to-primary/80 bg-clip-text text-transparent mb-2 break-words overflow-wrap-anywhere">
                    {greeting}
                  </h2>
                </div>
                
                {/* Weather Display */}
                <div
                  className="flex items-center gap-3 mt-3 md:mt-4 flex-shrink-0 px-3 py-2 rounded-2xl bg-primary/20 border border-primary/40 w-fit"
                >
                  <WeatherIcon className="h-5 w-5 md:h-6 md:w-6 text-primary flex-shrink-0" />
                  <span className="text-base md:text-lg font-medium text-primary whitespace-nowrap">
                    {weather ? `${weather.temp}°C` : "--°C"}
                  </span>
                </div>
              </div>
            )}

            {/* Right: Grid of 4 pill-shaped info items */}
            <div className={cn("flex-shrink-0", showGreeting ? "md:w-[70%] grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 min-w-0 w-full pr-[15px]" : "grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 min-w-0 w-full")}>
              {infoItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={cn(
                      "rounded-3xl px-2.5 py-2.5 flex items-start gap-2 md:gap-3",
                      item.bgColor,
                      "shadow-sm border",
                      item.borderColor,
                      "transition-all duration-150 hover:shadow-md hover:scale-[1.02]",
                      "min-w-0"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 md:h-5 md:w-5 flex-shrink-0 mt-0.5", item.color)} />
                    <div className="flex-1 min-w-0">
                      {item.text ? (
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5 truncate">
                            {item.label}
                          </p>
                          <p className="text-sm font-semibold text-foreground leading-[18px] line-clamp-2 break-words">
                            {item.text}
                          </p>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5 truncate">
                            {item.label}
                          </p>
                          <p className={cn("text-base md:text-lg font-bold truncate", item.color)}>
                            {item.value}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
}

