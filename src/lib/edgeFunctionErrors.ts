/**
 * Extract a human-readable message from supabase.functions.invoke failures.
 * FunctionsHttpError.context is a Response — read and parse its JSON body.
 */

export type EdgeFunctionErrorInfo = {
  message: string;
  code?: string;
  requestId?: string;
  status?: number;
};

function fromPayload(payload: Record<string, unknown>): EdgeFunctionErrorInfo | null {
  const code = typeof payload.code === "string" ? payload.code : undefined;
  const requestId =
    typeof payload.request_id === "string"
      ? payload.request_id
      : typeof payload.requestId === "string"
        ? payload.requestId
        : undefined;
  const message =
    (typeof payload.message === "string" && payload.message.trim()) ||
    (typeof payload.error === "string" && payload.error.trim()) ||
    null;
  if (!message && !code) return null;
  return {
    message: message || code || "Request failed",
    code,
    requestId,
  };
}

async function readResponseBody(response: Response): Promise<EdgeFunctionErrorInfo | null> {
  try {
    const text = await response.clone().text();
    if (!text.trim()) return null;
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      return fromPayload(parsed);
    } catch {
      return { message: text.slice(0, 240) };
    }
  } catch {
    return null;
  }
}

/**
 * Async parser for invoke() failures. Prefer this over the sync helper when
 * error.context may be a Response (FunctionsHttpError).
 */
export async function parseEdgeFunctionError(
  error: unknown,
  data?: unknown
): Promise<EdgeFunctionErrorInfo> {
  if (data && typeof data === "object") {
    const fromData = fromPayload(data as Record<string, unknown>);
    if (fromData) return fromData;
  }

  if (error && typeof error === "object") {
    const err = error as {
      name?: string;
      message?: string;
      context?: unknown;
    };

    const ctx = err.context;
    if (ctx instanceof Response) {
      const fromRes = await readResponseBody(ctx);
      const status = ctx.status;
      const sbCode = ctx.headers.get("sb-error-code") || undefined;
      if (fromRes) {
        return {
          ...fromRes,
          status,
          code: fromRes.code || sbCode,
          requestId:
            fromRes.requestId ||
            ctx.headers.get("sb-request-id") ||
            ctx.headers.get("x-sb-request-id") ||
            undefined,
        };
      }
      return {
        message: err.message || "Request failed",
        status,
        code: sbCode,
        requestId: ctx.headers.get("sb-request-id") || undefined,
      };
    }

    if (ctx && typeof ctx === "object") {
      const asRec = ctx as Record<string, unknown>;
      if (asRec.body && typeof asRec.body === "object") {
        const fromBody = fromPayload(asRec.body as Record<string, unknown>);
        if (fromBody) return fromBody;
      }
    }

    if (err.message && !/non-2xx/i.test(err.message)) {
      return { message: err.message };
    }
  }

  return { message: "Request failed" };
}

export function formatEdgeFunctionToast(info: EdgeFunctionErrorInfo): string {
  const base = info.message.trim() || "Request failed";
  if (info.requestId) {
    return `${base} Request: ${info.requestId}.`;
  }
  return base;
}

/** Sync fallback (billing and older callers). Prefer parseEdgeFunctionError. */
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
