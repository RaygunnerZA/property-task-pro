export class FillaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FillaError';
  }
}

/** Normalize Postgrest / unknown thrown values for UI (avoids "[object Object]"). */
export function toErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error == null) return fallback;
  if (typeof error === "string") {
    const trimmed = error.trim();
    return trimmed || fallback;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    for (const key of ["message", "error_description", "error", "details", "hint"] as const) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  try {
    const json = JSON.stringify(error);
    if (json && json !== "{}" && json !== "null") return json;
  } catch {
    /* ignore */
  }
  return fallback;
}
