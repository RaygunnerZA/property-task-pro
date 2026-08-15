export function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-6 text-sm leading-relaxed text-muted">
        This is a working notice, not a counsel-reviewed policy. A full privacy policy
        will replace this page before a public launch.
      </p>
      <div className="mt-8 space-y-4 text-base leading-relaxed">
        <p>
          The marketing site on www.filla.app is a static public site. It does not create
          accounts, store passwords, or talk to Filla’s application database.
        </p>
        <p>
          Accounts, organisation data, evidence, and sessions live only on the product
          origin (app.filla.app) and its backend. Signing in from a link on this site
          leaves this origin.
        </p>
        <p>
          If you write to us, we will use the address you provide only to reply.
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
