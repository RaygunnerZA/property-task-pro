import { useAssistantContext } from "@/contexts/AssistantContext";
import { GradientHeaderMaskedIcon } from "@/components/layout/GradientHeaderMaskedIcon";
import { FILLA_TURQUOISE } from "@/lib/brandColors";
import { cn } from "@/lib/utils";
import fillaAiIcon from "@/assets/filla-ai.svg";

const WORKBENCH_SEARCH_ICON = "/icons/workbench/search.svg";

export type WorkbenchCentreSearchProps = {
  /** e.g. "Ask about Reports or anything else." */
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
  /**
   * Called on Enter / search button. Defaults to opening Ask Filla with the query.
   * Local page filters should use `onChange`.
   */
  onSubmit?: (query: string) => void;
  className?: string;
  accentColor?: string;
  "aria-label"?: string;
};

/**
 * Pressed (debossed) search for the centre work column on activity-area screens.
 * Gradient-header search is hidden on those screens — this is the primary search.
 */
export function WorkbenchCentreSearch({
  placeholder,
  value,
  onChange,
  onSubmit,
  className,
  accentColor = FILLA_TURQUOISE,
  "aria-label": ariaLabel = "Search",
}: WorkbenchCentreSearchProps) {
  const { openAssistant, onSendMessage } = useAssistantContext();

  const handleSubmit = () => {
    const q = (value ?? "").trim();
    onSubmit?.(q);
    openAssistant();
    if (q) onSendMessage(q);
  };

  return (
    <div
      className={cn(
        "flex min-w-0 w-full items-stretch overflow-hidden rounded-card bg-card/70 shadow-search-pressed",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        <img
          src={fillaAiIcon}
          alt=""
          aria-hidden
          className="h-4 w-4 shrink-0 object-contain opacity-80"
          width={16}
          height={16}
        />
        <input
          type="search"
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground/70"
          aria-label={ariaLabel}
        />
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        className="inline-flex shrink-0 items-center justify-center px-3 transition-opacity hover:opacity-80"
        aria-label="Search"
      >
        <GradientHeaderMaskedIcon src={WORKBENCH_SEARCH_ICON} color={accentColor} />
      </button>
    </div>
  );
}

/** Placeholder copy: page topic first, then global Ask Filla. */
export function workbenchAskPlaceholder(topic: string): string {
  return `Ask about ${topic} or anything else.`;
}
