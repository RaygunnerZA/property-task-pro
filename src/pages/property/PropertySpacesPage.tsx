import { useMemo } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Layers } from "lucide-react";
import { StandardPage } from "@/components/design-system/StandardPage";
import { LoadingState } from "@/components/design-system/LoadingState";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import SpaceOrganisationScreen from "@/pages/spaces/SpaceOrganisationScreen";

/**
 * Property activity — Spaces entry.
 * Resolves `?property=` (or the sole org property) then renders the organise workspace.
 */
export default function PropertySpacesPage() {
  const [searchParams] = useSearchParams();
  const { data: properties = [], isLoading } = usePropertiesQuery();

  const targetPropertyId = useMemo(() => {
    const fromQuery = searchParams.get("property");
    if (fromQuery && properties.some((p) => p.id === fromQuery)) {
      return fromQuery;
    }
    if (properties.length === 1 && properties[0]?.id) {
      return properties[0].id;
    }
    return null;
  }, [searchParams, properties]);

  if (isLoading) {
    return (
      <StandardPage
        title="Spaces"
        icon={<Layers className="h-6 w-6" />}
        maxWidth="md"
      >
        <LoadingState message="Loading spaces…" />
      </StandardPage>
    );
  }

  if (!targetPropertyId) {
    return <Navigate to="/properties" replace />;
  }

  const fromQuery = searchParams.get("property");
  if (!fromQuery) {
    // Preserve other query keys (e.g. workTab, urgent) when syncing property scope.
    const next = new URLSearchParams(searchParams);
    next.set("property", targetPropertyId);
    return <Navigate to={`/property/spaces?${next.toString()}`} replace />;
  }

  return <SpaceOrganisationScreen />;
}
