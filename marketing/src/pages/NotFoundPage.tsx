import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center sm:px-8">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">404</p>
      <h1 className="mt-3 text-3xl font-semibold">That page is not here.</h1>
      <p className="mt-3 text-muted">The public site is small: overview, plans, privacy, terms.</p>
      <Link
        to="/"
        className="mt-8 inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-ink shadow-primary-btn"
      >
        Back to overview
      </Link>
    </div>
  );
}
