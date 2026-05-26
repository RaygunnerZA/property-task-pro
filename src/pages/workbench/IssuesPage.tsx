import Dashboard from "@/app/page";

/** Issues workbench (signals + open work) — formerly the Issues tab on Home. */
export default function IssuesPage() {
  return <Dashboard workbenchPanel="issues" />;
}
