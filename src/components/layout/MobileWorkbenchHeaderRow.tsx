import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOptionalWorkbenchControls } from "@/contexts/WorkbenchControlsContext";
import { cn } from "@/lib/utils";

const WORKBENCH_SEARCH_ICON = "/icons/workbench/search.svg";

const HEADER_ANIM_MS = 320;

type MobileWorkbenchHeaderRowProps = {
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  leftContent: ReactNode;
  showPropertySelector: boolean;
};

export function MobileWorkbenchHeaderSearchTrigger({
  searchOpen,
  onSearchOpenChange,
  variant = "onGradient",
}: {
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  variant?: "default" | "onGradient";
}) {
  const onGradient = variant === "onGradient";

  return (
    <button
      type="button"
      onClick={() => onSearchOpenChange(!searchOpen)}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full outline-none transition-shadow",
        onGradient
          ? "shadow-md ring-2 ring-white/45 backdrop-blur-sm focus-visible:ring-white/70"
          : "bg-card shadow-e1 hover:shadow-e2 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
      aria-label={searchOpen ? "Close search" : "Search"}
      aria-expanded={searchOpen}
    >
      {searchOpen ? (
        <X className={cn("h-5 w-5", onGradient ? "text-white" : "text-foreground")} strokeWidth={2.2} />
      ) : (
        <img
          src={WORKBENCH_SEARCH_ICON}
          alt=""
          className={cn("h-5 w-5 object-contain", onGradient && "brightness-0 invert")}
          width={20}
          height={20}
        />
      )}
    </button>
  );
}

export function MobileWorkbenchHeaderRow({
  searchOpen,
  onSearchOpenChange,
  leftContent,
  showPropertySelector,
}: MobileWorkbenchHeaderRowProps) {
  const navigate = useNavigate();
  const workbenchControls = useOptionalWorkbenchControls();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localQuery, setLocalQuery] = useState("");

  useEffect(() => {
    if (searchOpen) {
      setLocalQuery(workbenchControls?.searchQuery ?? "");
      const timer = window.setTimeout(() => inputRef.current?.focus(), HEADER_ANIM_MS);
      return () => window.clearTimeout(timer);
    }
  }, [searchOpen, workbenchControls?.searchQuery]);

  const commitSearch = (query: string) => {
    const trimmed = query.trim();
    if (workbenchControls) {
      workbenchControls.setSearchQuery(trimmed);
      return;
    }
    if (trimmed) {
      navigate(`/?search=${encodeURIComponent(trimmed)}`);
    }
  };

  const handleClose = () => {
    commitSearch(localQuery);
    onSearchOpenChange(false);
  };

  return (
    <div
      className={cn(
        "relative flex h-[var(--workbench-header-band,70px)] w-full items-center overflow-hidden pl-[13px] pr-[5.5rem] lg:hidden",
        !showPropertySelector && "h-[48px]"
      )}
    >
      {/* Property selector / logo — fades and shifts left as search enters */}
      <div
        className={cn(
          "absolute inset-y-0 left-[13px] right-[5.5rem] flex min-w-0 items-center transition-[transform,opacity] ease-out",
          searchOpen
            ? "pointer-events-none -translate-x-4 opacity-0"
            : "translate-x-0 opacity-100"
        )}
        style={{ transitionDuration: `${HEADER_ANIM_MS}ms` }}
        aria-hidden={searchOpen}
      >
        {leftContent}
      </div>

      {/* Search field — slides in from the right */}
      <div
        className={cn(
          "absolute inset-y-0 left-[13px] right-[5.5rem] flex min-w-0 items-center transition-[transform,opacity] ease-out",
          searchOpen
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-8 opacity-0"
        )}
        style={{ transitionDuration: `${HEADER_ANIM_MS}ms` }}
        aria-hidden={!searchOpen}
      >
        <div
          className={cn(
            "flex w-full min-w-0 items-stretch overflow-hidden rounded-full border border-white/35 bg-white/20 shadow-md ring-2 ring-white/40 backdrop-blur-sm",
            !searchOpen && "invisible"
          )}
        >
          <input
            ref={inputRef}
            type="search"
            value={localQuery}
            onChange={(e) => {
              const next = e.target.value;
              setLocalQuery(next);
              if (workbenchControls) {
                workbenchControls.setSearchQuery(next);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitSearch(localQuery);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                handleClose();
              }
            }}
            placeholder="Search anything..."
            className="min-w-0 flex-1 bg-transparent px-3.5 py-2 text-sm text-white outline-none placeholder:text-white/65"
            aria-label="Search"
            tabIndex={searchOpen ? 0 : -1}
          />
        </div>
      </div>
    </div>
  );
}
