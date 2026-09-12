import { useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/design-system/PageHeader";
import { WorkbenchHeaderToolbar } from "@/components/dashboard/WorkbenchHeaderToolbar";
import { HeaderAccountMenu } from "@/components/layout/HeaderAccountMenu";
import {
  MobileWorkbenchHeaderRow,
  MobileWorkbenchHeaderSearchTrigger,
} from "@/components/layout/MobileWorkbenchHeaderRow";
import {
  PropertySelectorStack,
  type PropertySelectorStackProps,
} from "@/components/properties/PropertySelectorStack";
import type { PropertySelectorRowProperty } from "@/components/properties/PropertySelectorRow";
import { IntakeActionButton } from "@/components/intake/IntakeActionButton";
import type { IntakeMode } from "@/types/intake";
import fillaDarkLogo from "@/assets/filla-dark.png";
import { paperTexturedGradientHeaderStyle } from "@/lib/paperTexture";
import { WORKBENCH_SIDE_RAIL_PX } from "@/lib/layoutBreakpoints";
import { cn } from "@/lib/utils";

/** Desktop workbench header band height (keep in sync with `index.css` / shell offset). */
const DESKTOP_HEADER_BAND_PX = 73;

function FillaLogoMark({ className }: { className?: string }) {
  return (
    <img
      src={fillaDarkLogo}
      alt="Filla"
      className={cn("h-[28px] w-auto shrink-0", className)}
    />
  );
}

/** Gradient strip: colour solid until ~33%, then fades to transparent, with paper grain. */
export function createGradientHeaderStyle(color: string): CSSProperties {
  return paperTexturedGradientHeaderStyle(color);
}

export type WorkbenchGradientHeaderProps = {
  headerStyle: CSSProperties;
  accentColor: string;
  properties: PropertySelectorRowProperty[];
  tasks?: PropertySelectorStackProps["tasks"];
  selectedPropertyIds: Set<string>;
  onPropertySelectionChange: (next: Set<string>) => void;
  onFilterClick?: (filterId: string) => void;
  onAskFilla?: (query: string) => void;
  /** Mid-width: Create Task / Add Record between Search and Profile. */
  onOpenIntake?: (mode: IntakeMode) => void;
  /** Activity-area screens move search into the centre column. */
  hideSearch?: boolean;
  /**
   * `workbench` (Home / Tasks / Calendar / Records): Filla logo + header search.
   * `activity` (Reports / Settings / …): [< Back] top-left with the property selector to its right.
   */
  variant?: "workbench" | "activity";
  /** Back handler for the activity variant. Defaults to history back (fallback `/`). */
  onBack?: () => void;
  headerEndSlot?: ReactNode;
};

export function WorkbenchGradientHeader({
  headerStyle,
  accentColor,
  properties,
  tasks = [],
  selectedPropertyIds,
  onPropertySelectionChange,
  onFilterClick,
  onAskFilla,
  onOpenIntake,
  hideSearch = false,
  variant = "workbench",
  onBack,
}: WorkbenchGradientHeaderProps) {
  const navigate = useNavigate();
  const showPropertySelector = properties.length > 1;
  const isActivity = variant === "activity";
  const showSearch = !hideSearch && !isActivity;

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const backButtonClassName = cn(
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-white/70 px-3",
    "text-sm font-medium text-foreground shadow-e1",
    "outline-none transition-shadow hover:shadow-md",
    "focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-1"
  );

  const renderBackButton = () => (
    <button
      type="button"
      onClick={handleBack}
      className={backButtonClassName}
      aria-label="Go back"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </button>
  );

  const mobileLeftContent = (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {isActivity ? (
        <span className="ml-1.5 shrink-0">{renderBackButton()}</span>
      ) : (
        <FillaLogoMark className="ml-1.5" />
      )}
      {showPropertySelector ? (
        <PropertySelectorStack
          variant="gradientHeader"
          properties={properties}
          tasks={tasks}
          selectedPropertyIds={selectedPropertyIds}
          onSelectionChange={onPropertySelectionChange}
          onFilterClick={onFilterClick}
          className="min-w-0 flex-1"
          suppressInteractions={mobileSearchOpen}
        />
      ) : null}
    </div>
  );

  return (
    <>
      <PageHeader
        showAccountMenu
        showSearch={showSearch}
        showFilter={false}
        style={headerStyle}
        accentColor={accentColor}
        className="page-header--workbench-mobile lg:hidden"
        toolbarClassName="!top-[calc(env(safe-area-inset-top,0px)+(var(--workbench-header-band,79px)/2))]"
        mobileSearchSlot={
          !showSearch ? undefined : (
            <MobileWorkbenchHeaderSearchTrigger
              searchOpen={mobileSearchOpen}
              onSearchOpenChange={setMobileSearchOpen}
              variant="onGradient"
              accentColor={accentColor}
            />
          )
        }
      >
        <MobileWorkbenchHeaderRow
          searchOpen={!showSearch ? false : mobileSearchOpen}
          onSearchOpenChange={setMobileSearchOpen}
          leftContent={mobileLeftContent}
          accentColor={accentColor}
          hideSearch={!showSearch}
        />
      </PageHeader>

      {/*
        Fixed full-viewport colour wash + paper noise (L→R fade to transparent).
        Fixed so it escapes main overflow-x clipping and sits above the left nav.
      */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[54] hidden lg:block"
        style={{ ...headerStyle, height: DESKTOP_HEADER_BAND_PX }}
      />
      <div
        className="fixed top-0 z-[56] hidden min-w-0 items-center gap-3 pl-5 pr-3 lg:flex"
        style={{
          height: DESKTOP_HEADER_BAND_PX,
          left: 0,
          maxWidth: `calc(var(--sidebar-width-icon, 3.09375rem) + ${WORKBENCH_SIDE_RAIL_PX}px - 0.75rem)`,
        }}
      >
        {isActivity ? (
          <span className="shrink-0">{renderBackButton()}</span>
        ) : (
          <Link
            to="/"
            className="flex shrink-0 items-center rounded-md outline-none ring-offset-2 ring-offset-transparent focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Go to home"
          >
            <FillaLogoMark />
          </Link>
        )}
        {showPropertySelector ? (
          <PropertySelectorStack
            variant="gradientHeader"
            properties={properties}
            tasks={tasks}
            selectedPropertyIds={selectedPropertyIds}
            onSelectionChange={onPropertySelectionChange}
            onFilterClick={onFilterClick}
            className="min-w-0 flex-1"
          />
        ) : null}
      </div>

      {/* Desktop: account avatar — vertically centred on the gradient band. */}
      <div
        className="fixed right-4 top-0 z-[56] hidden items-center lg:flex"
        style={{ height: DESKTOP_HEADER_BAND_PX }}
      >
        <HeaderAccountMenu variant="onGradient" accentColor={accentColor} />
      </div>

      <PageHeader
        showAccountMenu={false}
        showSearch={false}
        accentColor={accentColor}
        className="page-header--workbench-desktop hidden lg:block"
      >
        <div
          className={cn(
            "relative grid h-full w-full min-w-0 auto-rows-min content-center items-center gap-y-2 pr-14 sm:min-h-[var(--header-height,73px)] sm:gap-y-0 sm:pr-16",
            "grid-cols-1",
            "sm:grid-cols-workbench-dual",
            "layout:grid-cols-workbench-triple layout:gap-x-gutter-rail"
          )}
        >
          {/* Spacer under the fixed logo + property selector cluster */}
          <div className="relative z-10 min-w-0 px-3 sm:px-[18px]" aria-hidden />

          <div
            className={cn(
              "relative z-10 flex min-h-0 min-w-0 items-center gap-2 self-center px-3 sm:col-start-2 sm:px-1 sm:max-w-[700px]",
              "layout:max-w-[700px]"
            )}
          >
            {!showSearch ? null : (
              <WorkbenchHeaderToolbar
                variant="gradient"
                className="min-w-0 flex-1"
                properties={properties}
                onAskFilla={onAskFilla}
                accentColor={accentColor}
              />
            )}
            {/* Mid-width: CTAs sit beside search (not over it); hide when third column is open. */}
            {onOpenIntake ? (
              <div className="hidden shrink-0 items-center gap-1.5 md:flex layout:hidden">
                <IntakeActionButton
                  mode="report_issue"
                  variant="micro"
                  className="h-9 min-h-9 px-3 text-sm font-semibold"
                  onClick={() => onOpenIntake("report_issue")}
                />
                <IntakeActionButton
                  mode="add_record"
                  variant="micro"
                  className="h-9 min-h-9 px-3 text-sm font-semibold"
                  onClick={() => onOpenIntake("add_record")}
                />
              </div>
            ) : null}
          </div>

          {/* Spacer aligns with the third workbench column (intake / details live in-column). */}
          <div
            className={cn(
              "relative z-10 hidden min-w-0 self-stretch",
              "layout:block"
            )}
            aria-hidden
          />
        </div>
      </PageHeader>
    </>
  );
}
