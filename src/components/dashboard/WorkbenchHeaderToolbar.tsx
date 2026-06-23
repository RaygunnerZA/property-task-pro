import { cn } from "@/lib/utils";
import { useWorkbenchControls } from "@/contexts/WorkbenchControlsContext";
import { WorkbenchFiltersPopover } from "@/components/dashboard/WorkbenchFiltersPopover";
import { GradientHeaderMaskedIcon } from "@/components/layout/GradientHeaderMaskedIcon";
import {
  gradientHeaderSearchFieldClassName,
} from "@/lib/gradientHeaderControls";

const WORKBENCH_SEARCH_ICON = "/icons/workbench/search.svg";

type WorkbenchHeaderToolbarProps = {
  className?: string;
  /** On dashboard gradient header: no outer chrome — controls float on the strip. */
  variant?: "default" | "gradient";
  properties?: { id: string; name?: string | null; nickname?: string | null; address?: string | null }[];
  onAskFilla?: (query: string) => void;
  accentColor?: string;
};

export function WorkbenchHeaderToolbar({
  className,
  variant = "default",
  properties = [],
  onAskFilla,
  accentColor = "#8EC9CE",
}: WorkbenchHeaderToolbarProps) {
  const { searchQuery, setSearchQuery } = useWorkbenchControls();

  const handleAskFilla = () => {
    onAskFilla?.(searchQuery.trim());
  };

  const onGradient = variant === "gradient";

  return (
    <div
      className={cn(
        "workbench-toolbar",
        onGradient
          ? "flex min-w-0 items-stretch gap-2 border-0 bg-transparent py-0.5 px-0 shadow-none"
          : "flex min-w-0 items-stretch gap-2 rounded-xl border-0 bg-white py-0.5 px-1 shadow-none",
        className
      )}
    >
      <div
        className={cn(
          onGradient
            ? gradientHeaderSearchFieldClassName("flex-1")
            : "flex min-w-0 flex-1 items-stretch overflow-hidden rounded-lg border border-border/40 bg-input"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center px-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAskFilla();
            }}
            placeholder="Search anything..."
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/70"
            aria-label="Search workbench"
          />
        </div>
        {onGradient ? null : (
          <div className="w-px self-stretch bg-border/50" aria-hidden />
        )}
        <button
          type="button"
          onClick={handleAskFilla}
          className="inline-flex shrink-0 items-center justify-center px-3 transition-opacity hover:opacity-80"
          aria-label="Search"
        >
          {onGradient ? (
            <GradientHeaderMaskedIcon src={WORKBENCH_SEARCH_ICON} color={accentColor} />
          ) : (
            <img
              src={WORKBENCH_SEARCH_ICON}
              alt=""
              className="h-5 w-5 object-contain"
              width={20}
              height={20}
            />
          )}
        </button>
      </div>

      <WorkbenchFiltersPopover
        properties={properties}
        mode="toolbar"
        variant={variant}
        accentColor={accentColor}
      />
    </div>
  );
}
