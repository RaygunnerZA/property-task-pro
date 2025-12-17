import { Link, useLocation } from "react-router-dom";

export default function FooterNav() {
  const location = useLocation();
  const isActive = (p: string) => location.pathname === p;

  return (
    <footer className="h-16 bg-background border-t border-border flex items-center justify-around relative">
      <Link to="/" className={`flex flex-col items-center text-sm ${isActive("/") ? "text-primary" : "text-muted-foreground"}`}>
        🏠 Home
      </Link>
      <Link to="/work" className={`flex flex-col items-center text-sm ${isActive("/work") ? "text-primary" : "text-muted-foreground"}`}>
        🧰 Work
      </Link>

      {/* Floating FAB */}
      <Link
        to="/new-task"
        className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl shadow-fab"
      >
        +
      </Link>

      <Link to="/manage" className={`flex flex-col items-center text-sm ${isActive("/manage") ? "text-primary" : "text-muted-foreground"}`}>
        📁 Manage
      </Link>
      <Link to="/record" className={`flex flex-col items-center text-sm ${isActive("/record") ? "text-primary" : "text-muted-foreground"}`}>
        📚 Record
      </Link>
    </footer>
  );
}
