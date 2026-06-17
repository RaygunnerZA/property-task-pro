/** Extract a human-readable message from supabase.functions.invoke failures. */
export function edgeFunctionErrorMessage(
  error: unknown,
  data: unknown,
  fallback = "Request failed"
): string {
  if (data && typeof data === "object") {
    const payload = data as { error?: unknown; message?: unknown };
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  }

  if (error && typeof error === "object") {
    const err = error as { message?: string; context?: { body?: unknown } };
    const body = err.context?.body;
    if (body && typeof body === "object") {
      const parsed = body as { error?: unknown; message?: unknown };
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        return parsed.error;
      }
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        return parsed.message;
      }
    }
    if (err.message && !/non-2xx/i.test(err.message)) {
      return err.message;
    }
  }

  return fallback;
}
