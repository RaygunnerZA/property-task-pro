import { NavLink } from "react-router-dom";
import { appUrl } from "@/lib/urls";
import { cn } from "@/lib/cn";

const nav = [
  { to: "/", label: "Overview" },
  { to: "/pricing", label: "Plans" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <NavLink to="/" className="flex items-center gap-2" aria-label="Filla home">
          <img src="/filla-mark.svg" alt="" className="h-6 w-auto" width={18} height={24} />
          <span className="font-display text-lg font-semibold tracking-tight">Filla</span>
        </NavLink>

        <nav className="hidden items-center gap-6 sm:flex" aria-label="Primary">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "text-sm font-medium text-muted transition-colors hover:text-ink",
                  isActive && "text-ink"
                )
              }
              end={item.to === "/"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={appUrl("/login")}
            className="px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            Sign in
          </a>
          <a
            href={appUrl("/signup")}
            className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-ink shadow-primary-btn transition-transform active:scale-[0.98] active:shadow-btn-pressed"
          >
            Start free
          </a>
        </div>
      </div>
    </header>
  );
}
