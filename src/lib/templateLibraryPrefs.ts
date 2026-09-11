const MY_TEMPLATES_PREFIX = "filla-my-templates:";
const LAST_TASK_KEY = "filla-last-task-id";

function myTemplatesKey(orgId: string): string {
  return `${MY_TEMPLATES_PREFIX}${orgId}`;
}

export function readMyTemplateIds(orgId: string | null | undefined): Set<string> {
  if (!orgId || typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(myTemplatesKey(orgId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function writeMyTemplateIds(orgId: string, ids: Set<string>): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(myTemplatesKey(orgId), JSON.stringify([...ids]));
}

export function addMyTemplateId(orgId: string, templateId: string): Set<string> {
  const next = readMyTemplateIds(orgId);
  next.add(templateId);
  writeMyTemplateIds(orgId, next);
  return next;
}

export function removeMyTemplateId(orgId: string, templateId: string): Set<string> {
  const next = readMyTemplateIds(orgId);
  next.delete(templateId);
  writeMyTemplateIds(orgId, next);
  return next;
}

export function readLastTaskId(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(LAST_TASK_KEY);
}

export function writeLastTaskId(taskId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(LAST_TASK_KEY, taskId);
}
