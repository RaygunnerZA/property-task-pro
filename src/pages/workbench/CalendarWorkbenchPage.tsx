import Dashboard from "@/app/page";

/**
 * Primary workspace — Calendar tab (`/calendar`).
 * Centre strip: Tasks · Calendar · Records.
 */
export default function CalendarWorkbenchPage() {
  return <Dashboard workbenchPanel="workspace" defaultCentreTab="calendar" />;
}
