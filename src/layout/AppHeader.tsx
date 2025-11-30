import { useLocation } from "react-router-dom";
import { DS } from "../design-system/DesignSystem";

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
    <header
      className="px-4 py-3 flex items-center justify-between"
      style={{ 
        fontFamily: DS.font.family 
      }}
    >
      <h1 className="text-[20px] font-semibold text-[#1A1A1A]">
        {title}
      </h1>

      <div className="flex gap-3">
        <button className="w-9 h-9 rounded-full bg-white/60 backdrop-blur-md shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)]">
          🔍
        </button>
        <button className="w-9 h-9 rounded-full bg-white/60 backdrop-blur-md shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)]">
          👤
        </button>
      </div>
    </header>
  );
}
