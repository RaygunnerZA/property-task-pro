import { useCallback, useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ONBOARDING_EDUCATION_SUMMARY,
} from "@/fixtures/onboardingAttentionSamples";
import { onboardingEducationDismissStorageKey } from "@/lib/onboardingEducation";
import type { PropertyProfileId } from "@/lib/propertyProfiles";

type AttentionEducationSummaryProps = {
  propertyId?: string;
  propertyProfile?: PropertyProfileId | null;
  spacesCount?: number;
  className?: string;
};

function isCommercialProfile(profile: PropertyProfileId | null | undefined): boolean {
  return (
    profile === "commercial_building" ||
    profile === "rental_property" ||
    profile === "portfolio"
  );
}

export function AttentionEducationSummary({
  propertyId,
  propertyProfile,
  spacesCount = 0,
  className,
}: AttentionEducationSummaryProps) {
  const key = propertyId ? onboardingEducationDismissStorageKey(propertyId) : null;
  const [dismissed, setDismissed] = useState(() => {
    if (!key || typeof window === "undefined") return false;
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!key) return;
    try {
      setDismissed(localStorage.getItem(key) === "1");
    } catch {
      setDismissed(false);
    }
  }, [key]);

  const dismiss = useCallback(() => {
    if (!key) return;
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, [key]);

  if (dismissed || !propertyId) return null;

  const base = isCommercialProfile(propertyProfile)
    ? ONBOARDING_EDUCATION_SUMMARY.commercial
    : ONBOARDING_EDUCATION_SUMMARY.residential;

  const copy =
    spacesCount > 0 && !isCommercialProfile(propertyProfile)
      ? base.replace(
          "created spaces",
          `created ${spacesCount} space${spacesCount === 1 ? "" : "s"}`
        )
      : base;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-[10px] border-0 bg-card/80 px-3 py-2.5 shadow-md",
        "ring-1 ring-[#8EC9CE]/35",
        className
      )}
      role="status"
    >
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#8EC9CE]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">Example workspace</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{copy}</p>
        <p className="mt-1 text-[10px] font-mono uppercase tracking-wide text-[#8EC9CE]/90">
          Every item below is an example
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
        aria-label="Dismiss example workspace summary"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
