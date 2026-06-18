import type { CSSProperties } from "react";
import { PageHeader } from "@/components/design-system/PageHeader";
import { WorkbenchHeaderToolbar } from "@/components/dashboard/WorkbenchHeaderToolbar";
import {
  PropertySelectorStack,
  type PropertySelectorStackProps,
} from "@/components/properties/PropertySelectorStack";
import type { PropertySelectorRowProperty } from "@/components/properties/PropertySelectorRow";
import { WorkbenchMobileNavCluster } from "@/components/layout/WorkbenchMobileNavCluster";
import { cn } from "@/lib/utils";

/** Gradient strip: colour solid until ~28%, then fades to transparent. */
export function createGradientHeaderStyle(color: string): CSSProperties {
  return {
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
};

export function WorkbenchGradientHeader({
  headerStyle,
  properties,
  tasks = [],
  selectedPropertyIds,
  onPropertySelectionChange,
  onFilterClick,
  onAskFilla,
}: WorkbenchGradientHeaderProps) {
  const showPropertySelector = properties.length > 1;

  return (
    <PageHeader showAccountMenu={false}>
      <div
        className={cn(
          "grid w-full min-w-0 auto-rows-min items-start gap-2 rounded-bl-[12px] pr-28 sm:min-h-[80px] sm:gap-0 sm:pr-40",
          "min-h-[72px] pb-3 pt-3 sm:pb-0 sm:pt-0",
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
            <>
              <PropertySelectorStack
                variant="gradientHeader"
                properties={properties}
                tasks={tasks}
                selectedPropertyIds={selectedPropertyIds}
                onSelectionChange={onPropertySelectionChange}
                onFilterClick={onFilterClick}
                className="min-w-0 flex-1"
              />
              <WorkbenchMobileNavCluster className="shrink-0 sm:hidden" />
            </>
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
  );
}
