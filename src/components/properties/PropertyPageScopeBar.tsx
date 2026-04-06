import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { PropertyScopeFilterBar } from "@/components/properties/PropertyScopeFilterBar";

type PropertyPageScopeBarProps = {
  propertyId: string;
  hrefForProperty: (propertyId: string) => string;
  hrefForAll?: string;
  onBack: () => void;
};

/**
 * Secondary property scope strip + Back for property sub-pages (loads org properties for chips).
 */
export function PropertyPageScopeBar({
  propertyId,
  hrefForProperty,
  hrefForAll = "/",
  onBack,
}: PropertyPageScopeBarProps) {
  const { data: properties = [] } = usePropertiesQuery();
  return (
    <PropertyScopeFilterBar
      variant="secondary"
      properties={properties}
      currentPropertyId={propertyId}
      hrefForProperty={hrefForProperty}
      hrefForAll={hrefForAll}
      onBack={onBack}
    />
  );
}
