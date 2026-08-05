import { Navigate } from "react-router-dom";

/** Legacy Record pillar path — Reports now live under `/reports`. */
export default function RecordReports() {
  return <Navigate to="/reports" replace />;
}
