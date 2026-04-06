import { Navigate, useParams } from "react-router-dom";
import { propertyHubPath } from "@/lib/propertyRoutes";

/**
 * Replaces the legacy `/properties/:id` hub with the canonical dashboard URL `/?property=<id>`.
 */
export default function PropertyHubRedirect() {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return <Navigate to="/properties" replace />;
  }
  return <Navigate to={propertyHubPath(id)} replace />;
}
