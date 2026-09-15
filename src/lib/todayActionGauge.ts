export type TodayActionGauge = {
  /**
   * Progress clearing today’s due-now set (completed today ÷ completed today + still due/overdue).
   * Not lifetime backlog completion.
   */
  completionPct: number;
  /** Mono eyebrow above the dial — Today or Due now */
  gaugeEyebrow: string;
  /** Primary caption under the dial — remaining / clear-day copy */
  completedLabel: string;
  /** Quieter second line (e.g. open later, wins today) */
  gaugeHint: string | null;
};

type TaskLike = {
  status?: string | null;
  due_date?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
};

const TERMINAL_STATUSES = new Set(["completed", "archived", "done"]);

function isOpenTask(task: TaskLike): boolean {
  const status = (task.status ?? "").toLowerCase();
  return !TERMINAL_STATUSES.has(status);
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function localDayKey(d: Date): string {
  const x = startOfLocalDay(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Today-scoped action gauge: motivate clearing what is due now (today + overdue).
 * Ring = wins today / (wins today + still due now). Clear day → 100%.
 */
export function computeTodayActionGauge(
  tasks: TaskLike[],
  openTasksCount: number,
  now: Date = new Date()
): TodayActionGauge {
  const today = startOfLocalDay(now);
  const todayKey = localDayKey(today);

  let dueTodayOpen = 0;
  let overdueOpen = 0;
  let doneToday = 0;

  for (const task of tasks) {
    const status = (task.status ?? "").toLowerCase();
    const dueRaw = task.due_date ?? task.due_at ?? null;

    if (status === "completed" || status === "done") {
      if (task.completed_at && localDayKey(new Date(task.completed_at)) === todayKey) {
        doneToday += 1;
      }
      continue;
    }
    if (!isOpenTask(task) || !dueRaw) continue;

    const dueKey = localDayKey(new Date(dueRaw));
    if (dueKey === todayKey) dueTodayOpen += 1;
    else if (dueKey < todayKey) overdueOpen += 1;
  }

  const dueNowOpen = dueTodayOpen + overdueOpen;
  const todaySet = doneToday + dueNowOpen;

  if (dueNowOpen === 0) {
    if (openTasksCount <= 0) {
      return {
        completionPct: 100,
        gaugeEyebrow: "Today",
        completedLabel: "All clear",
        gaugeHint: null,
      };
    }
    return {
      completionPct: 100,
      gaugeEyebrow: "Today",
      completedLabel: "Nothing due today",
      gaugeHint:
        openTasksCount === 1 ? "1 open later" : `${openTasksCount} open later`,
    };
  }

  const completionPct =
    todaySet > 0 ? Math.round((doneToday / todaySet) * 100) : 0;

  const leftLabel =
    dueNowOpen === 1 ? "1 left today" : `${dueNowOpen} left today`;

  let gaugeHint: string | null = null;
  if (overdueOpen > 0 && dueTodayOpen > 0) {
    gaugeHint = overdueOpen === 1 ? "1 overdue" : `${overdueOpen} overdue`;
  } else if (doneToday > 0) {
    gaugeHint = doneToday === 1 ? "1 done today" : `${doneToday} done today`;
  } else if (overdueOpen > 0) {
    gaugeHint = "Clear overdue first";
  } else {
    gaugeHint = "Start here";
  }

  return {
    completionPct,
    gaugeEyebrow: overdueOpen > 0 ? "Due now" : "Today",
    completedLabel: leftLabel,
    gaugeHint,
  };
}
