/**
 * Code-native workbench stage — not a screenshot.
 * Mirrors the three-column operational workbench from @Docs/04_UI_System.md.
 */
export function WorkbenchStage() {
  return (
    <figure className="relative">
      <div
        className="rounded-[28px] bg-card p-3 shadow-e3 sm:p-4"
        aria-hidden="true"
      >
        <div className="grid gap-3 rounded-[22px] bg-paper p-3 shadow-engraved sm:grid-cols-[7.5rem_minmax(0,1fr)_8.5rem] sm:gap-2">
          <aside className="hidden rounded-2xl bg-card/80 p-3 shadow-e1 sm:block">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Property</p>
            <p className="mt-2 text-sm font-semibold">12 Harbour Walk</p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-muted">Today</p>
            <p className="mt-1 text-xs text-muted">Thu 15 Aug</p>
          </aside>

          <div className="rounded-2xl bg-card p-3 shadow-e1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">My Work</p>
              <p className="font-mono text-[10px] tabular-nums text-muted">3 open</p>
            </div>
            <ul className="mt-3 space-y-2">
              <li className="rounded-xl bg-paper px-3 py-2.5 shadow-engraved">
                <p className="text-sm font-medium">Boiler service — plant room</p>
                <p className="mt-0.5 text-xs text-muted">Checklist 4 of 6 · evidence due</p>
              </li>
              <li className="rounded-xl bg-paper px-3 py-2.5 shadow-engraved">
                <p className="text-sm font-medium">Fire door inspection — stair B</p>
                <p className="mt-0.5 text-xs text-muted">Today · assigned to Sam</p>
              </li>
              <li className="flex items-start justify-between gap-2 rounded-xl bg-paper px-3 py-2.5 shadow-engraved">
                <div>
                  <p className="text-sm font-medium">Photo from caretaker</p>
                  <p className="mt-0.5 text-xs text-muted">Needs a task</p>
                </div>
                <span className="mt-0.5 shrink-0 rounded-md bg-coral/15 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-coral">
                  Issue
                </span>
              </li>
            </ul>
          </div>

          <aside className="hidden rounded-2xl bg-card/80 p-3 shadow-e1 sm:block">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Checklist</p>
            <ul className="mt-3 space-y-2 text-xs text-muted">
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary-deep/70" />
                Isolate supply
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary-deep/70" />
                Record reading
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm border border-ink/20 bg-paper" />
                Attach photo
              </li>
            </ul>
          </aside>
        </div>
      </div>
      <figcaption className="mt-3 text-center font-mono text-[11px] uppercase tracking-wide text-muted">
        My Work — the centre of the workbench
      </figcaption>
    </figure>
  );
}
