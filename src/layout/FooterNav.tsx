import { Link, useLocation } from "react-router-dom";
import { Home, Briefcase, Folder, BookOpen, Plus } from "lucide-react";

export default function FooterNav() {
  const location = useLocation();
  const isActive = (p: string) => location.pathname === p;

  return (
    <footer className="h-16 bg-background border-t border-border flex items-center justify-around relative">
      <Link to="/" className={`flex flex-col items-center gap-1 text-sm ${isActive("/") ? "text-primary" : "text-muted-foreground"}`}>
        <Home className="h-5 w-5" />
        <span>Home</span>
      </Link>
      <Link to="/work" className={`flex flex-col items-center gap-1 text-sm ${isActive("/work") ? "text-primary" : "text-muted-foreground"}`}>
        <Briefcase className="h-5 w-5" />
        <span>Work</span>
      </Link>

      {/* Floating FAB */}
      <Link
        to="/new-task"
        className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-fab"
      >
        <Plus className="h-6 w-6" />
      </Link>

      <Link to="/manage" className={`flex flex-col items-center gap-1 text-sm ${isActive("/manage") ? "text-primary" : "text-muted-foreground"}`}>
        <Folder className="h-5 w-5" />
        <span>Manage</span>
      </Link>
      <Link to="/record" className={`flex flex-col items-center gap-1 text-sm ${isActive("/record") ? "text-primary" : "text-muted-foreground"}`}>
        <BookOpen className="h-5 w-5" />
        <span>Record</span>
      </Link>
    </footer>
  );
}
