import { AppCta } from "@/components/AppCta";
import { WorkbenchStage } from "@/components/WorkbenchStage";
import { PUBLIC_PLANS } from "@/lib/plans";
import { Link } from "react-router-dom";

const LOOP = [
  {
    step: "01",
    title: "Signals arrive",
    body: "Photos, emails, documents, weather, and compliance events land as infrastructure — not another inbox to manage.",
  },
  {
    step: "02",
    title: "Work is assigned",
    body: "Signals become tasks with checklists, owners, and due dates. Frontline users see what to finish today.",
  },
  {
    step: "03",
    title: "Evidence is kept",
    body: "Photos and records stay attached to the work. Evidence is treated as truth — not a note someone typed later.",
  },
];

const AUDIENCES = [
  {
    who: "Home",
    line: "One property. You coordinate it.",
  },
  {
    who: "Staff",
    line: "A queue of work, checklists, and photos to capture.",
  },
  {
    who: "Portfolio",
    line: "The same workbench, scoped to the buildings you run.",
  },
  {
    who: "Contractors",
    line: "A link to one job. Upload proof. No extra seat required.",
  },
];

export function HomePage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:pt-20">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-primary-deep">
            Operational workbench
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">
            Give the building a workbench.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            Filla turns building signals into tasks people finish — with checklists and
            evidence attached. Built for homes, portfolios, staff, and contractors.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <AppCta>Start Home — free</AppCta>
            <AppCta path="/login" variant="ghost">
              Sign in
            </AppCta>
          </div>
          <p className="mt-4 text-sm text-muted">
            Sign-in lives on app.filla.app. This site never holds a session.
          </p>
        </div>
        <WorkbenchStage />
      </section>

      <section className="border-y border-ink/5 bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">How work moves</p>
          <h2 className="mt-3 max-w-xl text-2xl font-semibold sm:text-3xl">
            Signals stay in the background. People see work.
          </h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {LOOP.map((item) => (
              <li key={item.step} className="relative md:pr-6">
                <p className="font-mono text-sm tabular-nums text-primary-deep">{item.step}</p>
                <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <p className="font-mono text-[11px] uppercase tracking-wide text-muted">Who uses it</p>
        <h2 className="mt-3 max-w-lg text-2xl font-semibold sm:text-3xl">
          One platform. Roles decide what you can do.
        </h2>
        <dl className="mt-10 divide-y divide-ink/10">
          {AUDIENCES.map((row) => (
            <div key={row.who} className="grid gap-1 py-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline sm:gap-8">
              <dt className="font-mono text-[11px] uppercase tracking-wide text-primary-deep">
                {row.who}
              </dt>
              <dd className="text-base text-ink sm:text-lg">{row.line}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <blockquote className="max-w-2xl rounded-[28px] bg-card px-6 py-8 shadow-e1 sm:px-10 sm:py-10">
          <p className="font-display text-2xl font-semibold leading-snug sm:text-3xl">
            AI proposes. Humans decide.
          </p>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
            Filla can classify, extract, and suggest. It does not override a person doing
            the work. Completing assigned work is never gated by a billing wall.
          </p>
        </blockquote>
      </section>

      <section className="border-t border-ink/5">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-muted">Plans</p>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Start with one property.</h2>
            </div>
            <Link to="/pricing" className="text-sm font-semibold text-primary-deep hover:underline">
              Compare plans
            </Link>
          </div>
          <ul className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-ink/10 shadow-e1 sm:grid-cols-2">
            {PUBLIC_PLANS.map((plan) => (
              <li key={plan.id} className="bg-card p-6">
                <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{plan.name}</p>
                <p className="mt-2 text-lg font-medium">{plan.buyer}</p>
                <p className="mt-1 text-sm text-muted">{plan.scope}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 rounded-[28px] bg-card px-6 py-10 shadow-e3 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div>
            <h2 className="text-2xl font-semibold">Open a Home workspace.</h2>
            <p className="mt-2 max-w-md text-sm text-muted">
              Free for one property and one coordinating member. Upgrade when a second
              person or a second building arrives.
            </p>
          </div>
          <AppCta>Start Home — free</AppCta>
        </div>
      </section>
    </>
  );
}
