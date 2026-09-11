import { describe, expect, it } from "vitest";
import {
  formatEdgeFunctionToast,
  parseEdgeFunctionError,
} from "@/lib/edgeFunctionErrors";

describe("edgeFunctionErrors", () => {
  it("parses structured function body from FunctionsHttpError Response context", async () => {
    const body = {
      ok: false,
      code: "provider_rate_limited",
      message: "The AI provider rejected the request due to its rate limit. Try again later.",
      request_id: "abc123",
    };
    const response = new Response(JSON.stringify(body), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "sb-error-code": "PROVIDER_RATE_LIMITED",
      },
    });
    const info = await parseEdgeFunctionError(
      { name: "FunctionsHttpError", message: "Edge Function returned a non-2xx status code", context: response },
      null
    );
    expect(info.status).toBe(429);
    expect(info.code).toBe("provider_rate_limited");
    expect(info.requestId).toBe("abc123");
    expect(formatEdgeFunctionToast(info)).toBe(
      "The AI provider rejected the request due to its rate limit. Try again later. Request: abc123."
    );
  });

  it("does not surface generic non-2xx when body is available on data", async () => {
    const info = await parseEdgeFunctionError(
      { message: "Edge Function returned a non-2xx status code" },
      {
        ok: false,
        code: "ai_not_configured",
        message: "Guidance could not be improved because no AI provider is configured.",
        request_id: "req-9",
      }
    );
    expect(formatEdgeFunctionToast(info)).toContain("no AI provider is configured");
    expect(formatEdgeFunctionToast(info)).toContain("Request: req-9");
  });

  it("maps FunctionsFetchError to deploy guidance for the invoked function", async () => {
    const info = await parseEdgeFunctionError(
      {
        name: "FunctionsFetchError",
        message: "Failed to send a request to the Edge Function",
      },
      null,
      "knowledge-gap-research"
    );
    expect(info.code).toBe("edge_function_unreachable");
    expect(formatEdgeFunctionToast(info)).toContain("knowledge-gap-research");
    expect(formatEdgeFunctionToast(info)).not.toContain("content-generate");
  });

  it("maps FunctionsFetchError without a function name to generic deploy guidance", async () => {
    const info = await parseEdgeFunctionError(
      {
        name: "FunctionsFetchError",
        message: "Failed to send a request to the Edge Function",
      },
      null
    );
    expect(info.code).toBe("edge_function_unreachable");
    expect(formatEdgeFunctionToast(info)).toContain("edge function");
    expect(formatEdgeFunctionToast(info)).not.toContain("content-generate");
  });
});
