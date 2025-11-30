import { Search, User } from "lucide-react";
import { DS } from "@/design-system/DesignSystem";

export default function AppHeader() {
  return (
    <header 
      className="h-14 px-4 flex items-center justify-between border-b"
      style={{ 
        backgroundColor: DS.colour.bg,
        borderColor: DS.colour.border 
      }}
    >
      <h1 
        className="text-[17px] font-semibold"
        style={{ color: DS.colour.text }}
      >
        Filla
      </h1>

      <div className="flex items-center gap-2">
        <button
          className="p-2 rounded-lg transition-all"
          style={{
            boxShadow: DS.shadow.soft
          }}
          aria-label="Search"
        >
          <Search size={18} color={DS.colour.textMuted} />
        </button>

        <button
          className="p-2 rounded-lg transition-all"
          style={{
            boxShadow: DS.shadow.soft
          }}
          aria-label="Account"
        >
          <User size={18} color={DS.colour.textMuted} />
        </button>
      </div>
    </header>
  );
}
