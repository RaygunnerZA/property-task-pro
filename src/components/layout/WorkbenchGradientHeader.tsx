import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/design-system/PageHeader";
import { WorkbenchHeaderToolbar } from "@/components/dashboard/WorkbenchHeaderToolbar";
import { WorkbenchFiltersPopover } from "@/components/dashboard/WorkbenchFiltersPopover";
import {
  MobileWorkbenchHeaderRow,
  MobileWorkbenchHeaderSearchTrigger,
} from "@/components/layout/MobileWorkbenchHeaderRow";
import {
  PropertySelectorStack,
  type PropertySelectorStackProps,
} from "@/components/properties/PropertySelectorStack";
import type { PropertySelectorRowProperty } from "@/components/properties/PropertySelectorRow";
import fillaDarkLogo from "@/assets/filla-dark.png";
import { paperTexturedGradientHeaderStyle } from "@/lib/paperTexture";
import { cn } from "@/lib/utils";

/** Matches DualPane left-rail `sm:pl-[12px]` so the gradient lines up with the property card. */
const HEADER_ALIGN_INSET_CLASS = "left-3";

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
}: WorkbenchGradientHeaderProps) {
  const showPropertySelector = properties.length > 1;

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const mobileLeftContent = (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <img
        src={fillaDarkLogo}
        alt="Filla"
        className="h-[28px] w-auto shrink-0"
      />
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
        showSearch
        showFilter
        style={headerStyle}
        accentColor={accentColor}
        className="page-header--workbench-mobile lg:hidden"
        toolbarClassName="!top-[calc(env(safe-area-inset-top,0px)+35px)]"
        mobileSearchSlot={
          <MobileWorkbenchHeaderSearchTrigger
            searchOpen={mobileSearchOpen}
            onSearchOpenChange={setMobileSearchOpen}
            variant="onGradient"
            accentColor={accentColor}
          />
        }
        mobileFilterSlot={
          <WorkbenchFiltersPopover
            properties={properties}
            mode="icon"
            variant="gradient"
            accentColor={accentColor}
          />
        }
      >
        <MobileWorkbenchHeaderRow
          searchOpen={mobileSearchOpen}
          onSearchOpenChange={setMobileSearchOpen}
          showPropertySelector={showPropertySelector}
          leftContent={mobileLeftContent}
          accentColor={accentColor}
        />
      </PageHeader>

      <PageHeader
        showAccountMenu={false}
        showSearch={false}
        accentColor={accentColor}
        className="page-header--workbench-desktop hidden lg:block"
      >
        <div
          className={cn(
            "relative grid w-full min-w-0 auto-rows-min items-start gap-2 pr-28 sm:min-h-[var(--workbench-header-band,70px)] sm:gap-0 sm:pr-40",
            "grid-cols-1",
            "sm:grid-cols-workbench-dual",
            "layout:grid-cols-workbench-triple"
          )}
        >
          {/* Inset gradient so its left edge matches the property card, not the sidebar. */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 rounded-l-xl",
              HEADER_ALIGN_INSET_CLASS
            )}
            style={headerStyle}
          />

          <div className="relative z-10 flex min-w-0 items-center gap-2.5 px-3 sm:px-[18px] sm:pt-[22px]">
            <Link
              to="/"
              className="flex shrink-0 items-center rounded-md outline-none ring-offset-2 ring-offset-transparent focus-visible:ring-2 focus-visible:ring-white/50"
              aria-label="Go to home"
            >
              <img
                src={fillaDarkLogo}
                alt="Filla"
                className="h-[28px] w-auto"
              />
            </Link>
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

          <div
            className={cn(
              "relative z-10 flex min-w-0 items-start px-3 sm:col-start-2 sm:px-1 sm:pt-5 sm:max-w-[700px]",
              "layout:max-w-[700px]"
            )}
          >
            <WorkbenchHeaderToolbar
              variant="gradient"
              className="w-full min-w-0"
              properties={properties}
              onAskFilla={onAskFilla}
              accentColor={accentColor}
            />
          </div>

          <div className="relative z-10 hidden min-w-0 layout:block" aria-hidden />
        </div>
      </PageHeader>
    </>
  );
}
