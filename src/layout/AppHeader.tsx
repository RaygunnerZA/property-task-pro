import { useLocation } from "react-router-dom";
import { Search, User } from "lucide-react";

const TITLES: Record<string, string> = {
  "/": "Home",
  "/work": "Work",
  "/manage": "Manage",
  "/record": "Record",
};

export default function AppHeader() {
  const location = useLocation();
  const title = TITLES[location.pathname] || "Filla";

  return (
    <header className="px-4 py-3 flex items-center justify-between font-sans">
      <h1 className="text-xl font-semibold text-foreground">
        {title}
      </h1>

      <div className="flex gap-3">
        <button className="w-9 h-9 rounded-full bg-card shadow-e1 flex items-center justify-center">
          <Search className="h-4 w-4" />
        </button>
        <button className="w-9 h-9 rounded-full bg-card shadow-e1 flex items-center justify-center">
          <User className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
