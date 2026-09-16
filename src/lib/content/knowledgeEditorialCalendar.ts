/**
 * Editorial calendar proposal — planning only.
 * Assigns restrained weekly windows; does not accept, draft, or distribute.
 */

export type CalendarProposal = {
  subjectKey: string;
  window_label: string;
  window_start: string; // ISO date (Monday of week)
  why: string;
  priority: number;
};

function mondayOfWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}

function addWeeks(d: Date, weeks: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + weeks * 7);
  return x;
}

function formatWeekLabel(monday: Date): string {
  return `Week of ${monday.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })}`;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Pilot ranking hypothesis (validate via coverage, not hard-coded forever):
 * 1 Chimney · 2 Heating season prep · 3 Smoke/CO · 4 Gutters · 5 France compliance later
 * Cadence: one primary international/regional package per week.
 */
export function proposePilotCalendarWindows(input: {
  now?: Date;
  subjectKeys: string[];
  heatingSeason?: boolean;
}): CalendarProposal[] {
  const now = input.now ?? new Date();
  const start = mondayOfWeek(now);
  const heating =
    input.heatingSeason ?? (now.getMonth() >= 8 && now.getMonth() <= 10);

  const order: Array<{ key: string; why: string; offsetWeeks: number }> = [];
  const keys = new Set(input.subjectKeys);

  if (keys.has("chimney-flue-sweeping")) {
    order.push({
      key: "chimney-flue-sweeping",
      why: "Heating-season opportunity",
      offsetWeeks: 0,
    });
  }
  if (keys.has("before-heating-season")) {
    order.push({
      key: "before-heating-season",
      why: heating
        ? "Prepare before the heating season"
        : "Seasonal preparation window",
      offsetWeeks: order.length > 0 ? 1 : 0,
    });
  }
  if (keys.has("smoke-carbon-monoxide-alarms")) {
    order.push({
      key: "smoke-carbon-monoxide-alarms",
      why: "High international safety relevance",
      offsetWeeks: Math.max(order.length, 0),
    });
  }
  if (keys.has("gutters-autumn-leaf-risk")) {
    order.push({
      key: "gutters-autumn-leaf-risk",
      why: "Autumn leaf and drainage risk",
      offsetWeeks: Math.max(order.length, 0),
    });
  }
  // Later France-specific — only if present and not already scheduled early
  if (keys.has("party-walls") || keys.has("private-sewage-systems")) {
    const frKey = keys.has("party-walls") ? "party-walls" : "private-sewage-systems";
    order.push({
      key: frKey,
      why: "France source coverage supports a country guide",
      offsetWeeks: Math.max(order.length + 1, 3),
    });
  }

  // Deduplicate keys keeping first
  const seen = new Set<string>();
  const unique = order.filter((o) => {
    if (seen.has(o.key)) return false;
    seen.add(o.key);
    return true;
  });

  // Re-number offsets to one package per week
  return unique.map((o, i) => {
    const monday = addWeeks(start, i);
    return {
      subjectKey: o.key,
      window_label: i === 0 && heating && o.key === "before-heating-season"
        ? "Before the heating season"
        : formatWeekLabel(monday),
      window_start: toIsoDate(monday),
      why: o.why,
      priority: 100 - i * 10,
    };
  });
}
