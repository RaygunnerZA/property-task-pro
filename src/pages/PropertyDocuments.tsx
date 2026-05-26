import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { propertyHubRecordsPath, type RecordsView } from "@/lib/propertyRoutes";

/**
 * Legacy `/properties/:id/documents` → Records workbench (documents slice).
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

  const base = propertyHubRecordsPath(id, recordsView);
  const q = new URLSearchParams(base.split("?")[1] ?? "");
  if (filter) {
    q.set("filter", filter);
  }
  const upload = searchParams.get("upload");
  if (upload) {
    q.set("upload", upload);
  }

  return <Navigate to={`/records?${q.toString()}`} replace />;
}
