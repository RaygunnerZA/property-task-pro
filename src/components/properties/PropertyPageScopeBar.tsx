import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { PropertyScopeFilterBar } from "@/components/properties/PropertyScopeFilterBar";
import { propertyHubPath } from "@/lib/propertyRoutes";

type PropertyPageScopeBarProps = {
  propertyId: string;
  hrefForProperty: (propertyId: string) => string;
  hrefForAll?: string;
  /** Defaults to property workbench hub (`/?property=`). */
  backHref?: string;
};

/**
 * Secondary property scope strip + Back for property sub-pages (loads org properties for chips).
 */
export function PropertyPageScopeBar({
  propertyId,
  hrefForProperty,
  hrefForAll = "/",
  backHref,
}: PropertyPageScopeBarProps) {
  const { data: properties = [] } = usePropertiesQuery();
  const propertyHubHref = propertyHubPath(propertyId);
  const resolvedBackHref = backHref ?? propertyHubHref;
  return (
    <PropertyScopeFilterBar
      variant="secondary"
      properties={properties}
      currentPropertyId={propertyId}
      hrefForProperty={hrefForProperty}
      hrefForAll={hrefForAll}
      propertyHubHref={propertyHubHref}
      backHref={resolvedBackHref}
    />
  );
}
