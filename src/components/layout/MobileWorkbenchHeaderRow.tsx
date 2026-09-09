import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOptionalWorkbenchControls } from "@/contexts/WorkbenchControlsContext";
import { cn } from "@/lib/utils";
import {
  GradientHeaderMaskedIcon,
} from "@/components/layout/GradientHeaderMaskedIcon";
import {
  gradientHeaderControlClassName,
  gradientHeaderSearchFieldClassName,
} from "@/lib/gradientHeaderControls";
import fillaAiIcon from "@/assets/filla-ai.svg";

const WORKBENCH_SEARCH_ICON = "/icons/workbench/search.svg";

const HEADER_ANIM_MS = 320;
/** Right inset for property row when search + filter + avatar are in the toolbar. */
const MOBILE_TOOLBAR_INSET = "8.75rem";

type MobileWorkbenchHeaderRowProps = {
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  leftContent: ReactNode;
  showPropertySelector: boolean;
  accentColor?: string;
  /** When true, omit expandable header search (centre-column search is used instead). */
  hideSearch?: boolean;
};

export function MobileWorkbenchHeaderSearchTrigger({
  searchOpen,
  onSearchOpenChange,
  variant = "onGradient",
  accentColor = "#8EC9CE",
}: {
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  variant?: "default" | "onGradient";
  accentColor?: string;
}) {
  const onGradient = variant === "onGradient";

  return (
    <button
      type="button"
      onClick={() => onSearchOpenChange(!searchOpen)}
      className={cn(
        onGradient
          ? gradientHeaderControlClassName()
          : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card shadow-e1 outline-none transition-shadow hover:shadow-e2 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
      aria-label={searchOpen ? "Close search" : "Search"}
      aria-expanded={searchOpen}
    >
      {searchOpen ? (
        <X
          className="h-5 w-5"
          style={{ color: onGradient ? accentColor : undefined }}
          strokeWidth={2.2}
        />
      ) : onGradient ? (
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
  );
}

export function MobileWorkbenchHeaderRow({
  searchOpen,
  onSearchOpenChange,
  leftContent,
  showPropertySelector,
  accentColor = "#8EC9CE",
  hideSearch = false,
}: MobileWorkbenchHeaderRowProps) {
  const navigate = useNavigate();
  const workbenchControls = useOptionalWorkbenchControls();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localQuery, setLocalQuery] = useState("");
  const effectiveSearchOpen = hideSearch ? false : searchOpen;
  const toolbarInset = hideSearch ? "3.75rem" : MOBILE_TOOLBAR_INSET;

  useEffect(() => {
    if (effectiveSearchOpen) {
      setLocalQuery(workbenchControls?.searchQuery ?? "");
      const timer = window.setTimeout(() => inputRef.current?.focus(), HEADER_ANIM_MS);
      return () => window.clearTimeout(timer);
    }
  }, [effectiveSearchOpen, workbenchControls?.searchQuery]);

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
        "relative flex h-[var(--workbench-header-band,70px)] w-full items-center overflow-hidden pl-[13px] lg:hidden",
        !showPropertySelector && "h-[48px]"
      )}
      style={{ paddingRight: toolbarInset }}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-[13px] flex min-w-0 items-center transition-[transform,opacity] ease-out",
          effectiveSearchOpen
            ? "pointer-events-none -translate-x-4 opacity-0"
            : "translate-x-0 opacity-100"
        )}
        style={{ right: toolbarInset, transitionDuration: `${HEADER_ANIM_MS}ms` }}
        aria-hidden={effectiveSearchOpen}
      >
        {leftContent}
      </div>

      {hideSearch ? null : (
      <div
        className={cn(
          "absolute inset-y-0 left-[13px] flex min-w-0 items-center transition-[transform,opacity] ease-out",
          effectiveSearchOpen
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-8 opacity-0"
        )}
        style={{ right: toolbarInset, transitionDuration: `${HEADER_ANIM_MS}ms` }}
        aria-hidden={!effectiveSearchOpen}
      >
        <div
          className={cn(
            gradientHeaderSearchFieldClassName("w-full items-center"),
            !effectiveSearchOpen && "invisible"
          )}
        >
          <img
            src={fillaAiIcon}
            alt=""
            aria-hidden
            className="ml-3.5 h-4 w-4 shrink-0 object-contain opacity-80"
            width={16}
            height={16}
          />
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
            placeholder="Search anything…"
            className="min-w-0 flex-1 bg-transparent px-3.5 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            aria-label="Search"
            tabIndex={effectiveSearchOpen ? 0 : -1}
          />
        </div>
      </div>
      )}
    </div>
  );
}
