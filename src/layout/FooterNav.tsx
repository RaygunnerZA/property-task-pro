import { Link, useLocation } from "react-router-dom";
import { DS } from "../design-system/DesignSystem";

export default function FooterNav() {
  const location = useLocation();
  const active = (p: string) =>
    location.pathname === p ? "text-[#0E8388]" : "text-[#6F6F6F]";

  return (
    <footer className="h-16 bg-[#F5F3F0] border-t border-black/10 flex items-center justify-around relative">
      <Link to="/" className={`flex flex-col items-center text-sm ${active("/")}`}>🏠 Home</Link>
      <Link to="/work" className={`flex flex-col items-center text-sm ${active("/work")}`}>🧰 Work</Link>

      {/* Floating FAB */}
      <Link
        to="/new-task"
        className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-[#0E8388] text-white flex items-center justify-center text-3xl shadow-lg"
      >
        +
      </Link>

      <Link to="/manage" className={`flex flex-col items-center text-sm ${active("/manage")}`}>📁 Manage</Link>
      <Link to="/record" className={`flex flex-col items-center text-sm ${active("/record")}`}>📚 Record</Link>
    </footer>
  );
}
