export function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Terms</h1>
      <p className="mt-6 text-sm leading-relaxed text-muted">
        This is a working notice, not a counsel-reviewed agreement. Binding terms will
        replace this page before a public launch.
      </p>
      <div className="mt-8 space-y-4 text-base leading-relaxed">
        <p>
          The public website describes Filla. Using the product requires creating an
          account on app.filla.app, which is a separate service with its own session.
        </p>
        <p>
          Home is a free plan for one active property and one coordinating member.
          Paid plans, add-ons, and usage meters are described on the Plans page and
          enforced in the product.
        </p>
        <p>
          Do not submit unlawful content, attempt to access another organisation’s data,
          or use the service to harm people or buildings.
        </p>
        <p>
          Contact:{" "}
          <a className="font-medium underline decoration-primary underline-offset-4" href="mailto:hello@filla.app">
            hello@filla.app
          </a>
        </p>
      </div>
    </article>
  );
}
