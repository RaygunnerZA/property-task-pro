import { Navigate, useParams, useSearchParams } from "react-router-dom";
import {
  WORKBENCH_PANEL_TAB_QUERY,
  WORKBENCH_RECORDS_VIEW_QUERY,
  type RecordsView,
} from "@/lib/propertyRoutes";

/**
 * Legacy `/properties/:id/documents` → hub Records (documents slice).
 * Preserves `filter`, `upload` query params for the Records workspace.
 */
export default function PropertyDocuments() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  if (!id) {
    return <Navigate to="/properties" replace />;
  }

  const filter = searchParams.get("filter");
  let recordsView: RecordsView = "documents";
  if (filter === "expiring") recordsView = "expiring";
  else if (filter === "expired") recordsView = "overdue";
  else if (filter === "hazards" || filter === "unlinked") recordsView = "documents";

  const q = new URLSearchParams();
  q.set("property", id);
  q.set(WORKBENCH_PANEL_TAB_QUERY, "records");
  if (recordsView !== "all") {
    q.set(WORKBENCH_RECORDS_VIEW_QUERY, recordsView);
  }
  if (filter) {
    q.set("filter", filter);
  }
  const upload = searchParams.get("upload");
  if (upload) {
    q.set("upload", upload);
  }

  return <Navigate to={`/?${q.toString()}`} replace />;
}
