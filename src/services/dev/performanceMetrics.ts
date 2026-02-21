/**
 * Performance Metrics — Dev Instrumentation
 *
 * Lightweight performance tracking for dev mode.
 * Collects timing data for chip suggestion, DB queries, and render cycles.
 * Data is stored in-memory and surfaced via the AI Debug Panel.
 */

export interface PerfEntry {
  label: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

const MAX_ENTRIES = 200;
const entries: PerfEntry[] = [];
const listeners: Set<() => void> = new Set();

export function recordPerf(
  label: string,
  startMs: number,
  endMs: number,
  metadata?: Record<string, unknown>
): void {
  entries.push({
    label,
    startMs,
    endMs,
    durationMs: Math.round((endMs - startMs) * 100) / 100,
    metadata,
  });
  if (entries.length > MAX_ENTRIES) entries.shift();
  listeners.forEach((fn) => fn());
}

export function measureAsync<T>(
  label: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const start = performance.now();
  return fn().then(
    (result) => {
      recordPerf(label, start, performance.now(), metadata);
      return result;
    },
    (err) => {
      recordPerf(label, start, performance.now(), {
        ...metadata,
        error: true,
      });
      throw err;
    }
  );
}

export function measureSync<T>(
  label: string,
  fn: () => T,
  metadata?: Record<string, unknown>
): T {
  const start = performance.now();
  try {
    const result = fn();
    recordPerf(label, start, performance.now(), metadata);
    return result;
  } catch (err) {
    recordPerf(label, start, performance.now(), { ...metadata, error: true });
    throw err;
  }
}

export function getPerfEntries(): readonly PerfEntry[] {
  return entries;
}

export function clearPerfEntries(): void {
  entries.length = 0;
  listeners.forEach((fn) => fn());
}

export function subscribePerfEntries(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAggregatedMetrics(): Record<
  string,
  { count: number; avgMs: number; minMs: number; maxMs: number }
> {
  const map: Record<
    string,
    { count: number; totalMs: number; minMs: number; maxMs: number }
  > = {};

  for (const e of entries) {
    if (!map[e.label]) {
      map[e.label] = {
        count: 0,
        totalMs: 0,
        minMs: Infinity,
        maxMs: -Infinity,
      };
    }
    const m = map[e.label];
    m.count++;
    m.totalMs += e.durationMs;
    m.minMs = Math.min(m.minMs, e.durationMs);
    m.maxMs = Math.max(m.maxMs, e.durationMs);
  }

  const result: Record<
    string,
    { count: number; avgMs: number; minMs: number; maxMs: number }
  > = {};
  for (const [label, m] of Object.entries(map)) {
    result[label] = {
      count: m.count,
      avgMs: Math.round((m.totalMs / m.count) * 100) / 100,
      minMs: m.minMs === Infinity ? 0 : m.minMs,
      maxMs: m.maxMs === -Infinity ? 0 : m.maxMs,
    };
  }
  return result;
}
