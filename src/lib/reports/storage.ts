import type { ReportInstance, ReportSnapshot } from "./types";

const STORAGE_KEY = "filla_report_instances";

function scopedKey(orgId: string): string {
  return `${STORAGE_KEY}:${orgId}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

export function listReportInstances(orgId: string): ReportInstance[] {
  const list = readJson<ReportInstance[]>(scopedKey(orgId), []);
  return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getReportInstance(
  orgId: string,
  id: string
): ReportInstance | null {
  return listReportInstances(orgId).find((r) => r.id === id) ?? null;
}

export function upsertReportInstance(instance: ReportInstance): ReportInstance {
  const list = listReportInstances(instance.orgId);
  const idx = list.findIndex((r) => r.id === instance.id);
  const next = { ...instance, updatedAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  writeJson(scopedKey(instance.orgId), list);
  return next;
}

export function deleteReportInstance(orgId: string, id: string): void {
  const list = listReportInstances(orgId).filter((r) => r.id !== id);
  writeJson(scopedKey(orgId), list);
}

export function finalizeReportInstance(
  orgId: string,
  id: string,
  snapshot: ReportSnapshot
): ReportInstance | null {
  const current = getReportInstance(orgId, id);
  if (!current) return null;
  const now = new Date().toISOString();
  return upsertReportInstance({
    ...current,
    status: "finalized",
    snapshot,
    finalizedAt: now,
    aiSummary: snapshot.briefParagraph || current.aiSummary,
  });
}

export function createReportId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
