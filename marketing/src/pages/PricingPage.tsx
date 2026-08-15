import { AppCta } from "@/components/AppCta";
import { PUBLIC_PLANS } from "@/lib/plans";
import { cn } from "@/lib/cn";

export function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="font-mono text-[11px] uppercase tracking-wide text-primary-deep">Plans</p>
      <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        Pay for coordination. Not for finishing the job.
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
        Plans are built around active properties and coordinating members. People doing
        assigned work keep access to their queue, checklists, and existing evidence.
      </p>

      <div className="mt-12 grid gap-6 lg:grid-cols-4">
        {PUBLIC_PLANS.map((plan) => (
          <article
            key={plan.id}
            className={cn(
              "flex flex-col rounded-[24px] bg-card p-6 shadow-e1",
              plan.featured && "shadow-e3 ring-1 ring-primary/50"
            )}
          >
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{plan.name}</p>
            {plan.featured ? (
              <p className="mt-2 font-mono text-[11px] uppercase tracking-wide text-primary-deep">
                Start here
              </p>
            ) : null}
            <h2 className="mt-3 text-lg font-semibold leading-snug">{plan.buyer}</h2>
            <p className="mt-2 text-sm text-muted">{plan.scope}</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-ink/80">
              {plan.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <AppCta path={plan.cta.path} className="mt-6 w-full" variant={plan.featured ? "primary" : "ghost"}>
              {plan.cta.label}
            </AppCta>
          </article>
        ))}
      </div>

      <details className="mt-12 rounded-[24px] bg-card p-6 shadow-e1">
        <summary className="cursor-pointer text-sm font-semibold">
          Storage, AI, and messaging allowances
        </summary>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          Evidence storage, AI operations, and premium messaging (SMS, WhatsApp, voice)
          are metered on top of the plan. They are not the headline of the table. When an
          allowance is reached, manual work continues; new premium consumption pauses until
          you add a pack or wait for the next period.
        </p>
      </details>

      <section className="mt-14 max-w-2xl">
        <h2 className="text-xl font-semibold">Contractor track</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Occasional contributors use a secure link to a shared task — not a coordinating
          seat. Contractor organisations that upload into client workspaces use a separate
          Contractor Pro track, not a fifth consumer pricing card.
        </p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="text-xl font-semibold">Enterprise</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Enterprise is a negotiated Business contract: SLA, residency, legal hold, custom
          security, migration, and training. It is not listed as a fifth public plan.
        </p>
      </section>
    </div>
  );
}
