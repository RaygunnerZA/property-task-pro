import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { propertyHubRecordsPath } from "@/lib/propertyRoutes";

/**
 * Legacy `/properties/:id/compliance` → Records workbench (compliance slice).
 * Preserves `addRule` for opening the rule modal in Records.
 */
export default function PropertyCompliance() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  if (!id) {
    return <Navigate to="/properties" replace />;
  }

  const base = propertyHubRecordsPath(id, "compliance");
  const q = new URLSearchParams(base.split("?")[1] ?? "");
  const addRule = searchParams.get("addRule");
  if (addRule) {
    q.set("addRule", addRule);
  }

  return <Navigate to={`/records?${q.toString()}`} replace />;
}
