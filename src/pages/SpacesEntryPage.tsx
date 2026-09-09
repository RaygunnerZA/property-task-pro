import { useMemo } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Layers } from "lucide-react";
import { StandardPage } from "@/components/design-system/StandardPage";
import { LoadingState } from "@/components/design-system/LoadingState";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { propertyHubSpacesPath } from "@/lib/propertyRoutes";

/**
 * Portfolio entry for Spaces — sends you to the scoped property’s organise screen.
 * Multi-property orgs without `?property=` land on Properties to pick one.
 */
export default function SpacesEntryPage() {
  const [searchParams] = useSearchParams();
  const { data: properties = [], isLoading } = usePropertiesQuery();

  const target = useMemo(() => {
    const fromQuery = searchParams.get("property");
    if (fromQuery && properties.some((p) => p.id === fromQuery)) {
      return propertyHubSpacesPath(fromQuery);
    }
    if (properties.length === 1 && properties[0]?.id) {
      return propertyHubSpacesPath(properties[0].id);
    }
    return null;
  }, [searchParams, properties]);

  if (isLoading) {
    return (
      <StandardPage
        title="Spaces"
        icon={<Layers className="h-6 w-6" />}
        maxWidth="md"
        hideHeaderSearch
        headerVariant="activity"
      >
        <LoadingState message="Loading spaces…" />
      </StandardPage>
    );
  }

  if (target) {
    return <Navigate to={target} replace />;
  }

  return <Navigate to="/properties" replace />;
}
