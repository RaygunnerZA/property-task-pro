import fillaAiIcon from "@/assets/filla-ai.svg";
import { cn } from "@/lib/utils";

type RecordsSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function RecordsSearchField({ value, onChange, className }: RecordsSearchFieldProps) {
  return (
    <div
      className={cn(
        "flex h-12 min-h-12 min-w-0 w-full items-center gap-2 overflow-hidden rounded-card bg-card/70 px-3 shadow-search-pressed",
        className
      )}
    >
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search records, certificates, or types"
        className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground/70"
        aria-label="Search records"
      />
    </div>
  );
}
