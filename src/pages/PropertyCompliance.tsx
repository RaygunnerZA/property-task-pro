import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { WORKBENCH_PANEL_TAB_QUERY, WORKBENCH_RECORDS_VIEW_QUERY } from "@/lib/propertyRoutes";

/**
 * Legacy `/properties/:id/compliance` → hub Records (compliance slice).
 * Preserves `addRule` for opening the rule modal in Records.
 */
export default function PropertyCompliance() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  if (!id) {
    return <Navigate to="/properties" replace />;
  }

  const q = new URLSearchParams();
  q.set("property", id);
  q.set(WORKBENCH_PANEL_TAB_QUERY, "records");
  q.set(WORKBENCH_RECORDS_VIEW_QUERY, "compliance");
  const addRule = searchParams.get("addRule");
  if (addRule) {
    q.set("addRule", addRule);
  }

  return <Navigate to={`/?${q.toString()}`} replace />;
}
