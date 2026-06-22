import { useMemo, useState, type CSSProperties } from "react";
import { PageHeader } from "@/components/design-system/PageHeader";
import { WorkbenchHeaderToolbar } from "@/components/dashboard/WorkbenchHeaderToolbar";
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
import { isAllPropertiesActive } from "@/utils/propertyFilter";
import { cn } from "@/lib/utils";

/** Gradient strip: colour solid until ~28%, then fades to transparent. */
export function createGradientHeaderStyle(color: string): CSSProperties {
  return {
    backgroundColor: color,
    backgroundImage: `linear-gradient(90deg, ${color} 0%, ${color} 28%, transparent 97%, transparent 100%)`,
  };
}

export type WorkbenchGradientHeaderProps = {
  headerStyle: CSSProperties;
  properties: PropertySelectorRowProperty[];
  tasks?: PropertySelectorStackProps["tasks"];
  selectedPropertyIds: Set<string>;
  onPropertySelectionChange: (next: Set<string>) => void;
  onFilterClick?: (filterId: string) => void;
  onAskFilla?: (query: string) => void;
  /** Home hub: on mobile, show brand logo instead of the property dropdown while all properties are selected. */
  mobileBrandLogoWhenAllProperties?: boolean;
};

export function WorkbenchGradientHeader({
  headerStyle,
  properties,
  tasks = [],
  selectedPropertyIds,
  onPropertySelectionChange,
  onFilterClick,
  onAskFilla,
  mobileBrandLogoWhenAllProperties = false,
}: WorkbenchGradientHeaderProps) {
  const showPropertySelector = properties.length > 1;
  const allPropertyIds = useMemo(() => properties.map((p) => p.id), [properties]);
  const isAllPropertiesSelected = useMemo(
    () => isAllPropertiesActive(selectedPropertyIds, allPropertyIds),
    [allPropertyIds, selectedPropertyIds]
  );
  const showMobileBrandLogo =
    mobileBrandLogoWhenAllProperties && showPropertySelector && isAllPropertiesSelected;

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const mobileLeftContent = showMobileBrandLogo ? (
    <img src={fillaDarkLogo} alt="Filla" className="h-[28px] w-auto shrink-0" />
  ) : showPropertySelector ? (
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
  ) : null;

  return (
    <>
      {/* Mobile / tablet: compact header row (< lg) */}
      <PageHeader
        showAccountMenu
        showSearch
        className="page-header--workbench-mobile lg:hidden"
        toolbarClassName="!top-[calc(env(safe-area-inset-top,0px)+35px)]"
        mobileSearchSlot={
          <MobileWorkbenchHeaderSearchTrigger
            searchOpen={mobileSearchOpen}
            onSearchOpenChange={setMobileSearchOpen}
            variant="onGradient"
          />
        }
      >
        <div style={headerStyle}>
          <MobileWorkbenchHeaderRow
            searchOpen={mobileSearchOpen}
            onSearchOpenChange={setMobileSearchOpen}
            showPropertySelector={showPropertySelector}
            leftContent={mobileLeftContent}
          />
        </div>
      </PageHeader>

      {/* Desktop: aligned 2/3-column workbench header grid (lg+) */}
      <PageHeader
        showAccountMenu={false}
        showSearch={false}
        className="page-header--workbench-desktop hidden lg:block"
      >
        <div
          className={cn(
            "grid w-full min-w-0 auto-rows-min items-start gap-2 rounded-bl-[12px] pr-28 sm:min-h-[var(--workbench-header-band,70px)] sm:gap-0 sm:pr-40",
            "grid-cols-1",
            "sm:grid-cols-workbench-dual",
            "layout:grid-cols-workbench-triple"
          )}
          style={headerStyle}
        >
          <div
            className={cn(
              "flex min-w-0 items-center justify-between gap-2 px-3 sm:justify-start sm:px-[18px] sm:pt-[25px]",
              !showPropertySelector && "hidden sm:block sm:invisible"
            )}
          >
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
              "flex min-w-0 items-start px-3 sm:col-start-2 sm:px-1 sm:pt-5 sm:max-w-[700px]",
              "layout:max-w-[700px]"
            )}
          >
            <WorkbenchHeaderToolbar
              variant="gradient"
              className="w-full min-w-0"
              properties={properties}
              onAskFilla={onAskFilla}
            />
          </div>

          <div className="hidden min-w-0 layout:block" aria-hidden />
        </div>
      </PageHeader>
    </>
  );
}
