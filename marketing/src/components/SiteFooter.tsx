import { NavLink } from "react-router-dom";
import { appUrl } from "@/lib/urls";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-ink/5">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <p className="font-display text-lg font-semibold">Filla</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            A workbench for building operations. The product lives on a separate origin.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted" aria-label="Footer">
          <NavLink to="/pricing" className="hover:text-ink">
            Plans
          </NavLink>
          <a href={appUrl("/login")} className="hover:text-ink">
            Sign in
          </a>
          <NavLink to="/privacy" className="hover:text-ink">
            Privacy
          </NavLink>
          <NavLink to="/terms" className="hover:text-ink">
            Terms
          </NavLink>
        </nav>
      </div>
    </footer>
  );
}
