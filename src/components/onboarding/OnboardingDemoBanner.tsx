import { useCallback, useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { onboardingDemoBannerStorageKey } from "@/lib/onboardingDemo";

type OnboardingDemoBannerProps = {
  propertyId: string;
  className?: string;
};

/**
 * Dismissible callout when the property still has seeded sample data (SaaS-style empty state).
 */
export function OnboardingDemoBanner({ propertyId, className }: OnboardingDemoBannerProps) {
  const key = onboardingDemoBannerStorageKey(propertyId);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(key) === "1");
    } catch {
      setDismissed(false);
    }
  }, [key]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, [key]);

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "mb-2 flex items-start gap-2 rounded-[10px] border-0 bg-card/80 px-3 py-2.5 shadow-md",
        "ring-1 ring-[#8EC9CE]/35",
        className
      )}
      role="status"
    >
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#8EC9CE]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">You&apos;re viewing sample content</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          We added a few tasks, assets, and compliance examples so you can explore without starting from
          zero. Swap in real photos and files anytime, or delete rows you don&apos;t need.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className={cn(
          "shrink-0 rounded-md p-1 text-muted-foreground transition-colors",
          "hover:bg-muted/60 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EC9CE]/40 focus-visible:ring-offset-0"
        )}
        aria-label="Dismiss sample content message"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
