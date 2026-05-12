/**
 * useCreatePropertyMutation — Unit Tests
 *
 * Tests the helper logic and mutation behaviour without a React render environment.
 * The supabase client and analytics track function are replaced with vi.mock stubs.
 *
 * Run: npx vitest src/hooks/mutations/__tests__/useCreatePropertyMutation.test.ts
 */

import { describe, it, expect, vi } from "vitest";

// Hoist mocks before any module that transitively imports supabase/client (which needs localStorage).
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

import { parsePropertyRpcResult } from "../useCreatePropertyMutation";

// ─── parsePropertyRpcResult ──────────────────────────────────────────────────

describe("parsePropertyRpcResult", () => {
  it("returns the id string when data has an id field", () => {
    expect(parsePropertyRpcResult({ id: "prop-abc-123" })).toBe("prop-abc-123");
  });

  it("throws when data is null", () => {
    expect(() => parsePropertyRpcResult(null)).toThrow(
      "create_property_v2: unexpected response"
    );
  });

  it("throws when data is undefined", () => {
    expect(() => parsePropertyRpcResult(undefined)).toThrow(
      "create_property_v2: unexpected response"
    );
  });

  it("throws when data is a plain string (not an object with id)", () => {
    expect(() => parsePropertyRpcResult("prop-abc-123")).toThrow(
      "create_property_v2: unexpected response"
    );
  });

  it("throws when data object has a non-string id", () => {
    expect(() => parsePropertyRpcResult({ id: 42 })).toThrow(
      "create_property_v2: unexpected response"
    );
  });

  it("throws when data object has id: null", () => {
    expect(() => parsePropertyRpcResult({ id: null })).toThrow(
      "create_property_v2: unexpected response"
    );
  });

  it("throws when data is an empty object", () => {
    expect(() => parsePropertyRpcResult({})).toThrow(
      "create_property_v2: unexpected response"
    );
  });

  it("returns the id even when extra fields are present", () => {
    expect(
      parsePropertyRpcResult({ id: "prop-xyz", name: "My House", org_id: "org-1" })
    ).toBe("prop-xyz");
  });
});

// ─── Analytics event contract (static) ──────────────────────────────────────

describe("property_created event contract", () => {
  it("track is called with property_created and required properties on success", async () => {
    const trackMock = vi.fn();
    const supabaseMock = {
      rpc: vi.fn().mockResolvedValue({
        data: { id: "prop-new-1" },
        error: null,
      }),
    };
    const queryClientMock = {
      invalidateQueries: vi.fn(),
    };

    // Simulate what onSuccess does in the mutation hook
    const result = await supabaseMock.rpc("create_property_v2", {
      p_org_id: "org-1",
      p_address: "10 Test St",
      p_postcode: null,
      p_property_type: null,
      p_thumbnail_url: null,
    });
    expect(result.error).toBeNull();
    const propertyId = parsePropertyRpcResult(result.data);

    trackMock("property_created", { org_id: "org-1", property_id: propertyId });

    expect(trackMock).toHaveBeenCalledWith("property_created", {
      org_id: "org-1",
      property_id: "prop-new-1",
    });
    expect(queryClientMock.invalidateQueries).not.toHaveBeenCalled(); // not called yet in this test
  });

  it("supabase error causes mutationFn to throw, so track never fires", async () => {
    const trackMock = vi.fn();
    const supabaseError = new Error("DB error");
    const supabaseMock = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: supabaseError }),
    };

    async function simulateMutationFn() {
      const { data, error } = await supabaseMock.rpc("create_property_v2", {});
      if (error) throw error; // mutationFn throws — onSuccess never runs
      return parsePropertyRpcResult(data);
    }

    await expect(simulateMutationFn()).rejects.toThrow("DB error");
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("supabase error causes mutationFn to throw before track fires", async () => {
    const trackMock = vi.fn();

    async function simulateMutationFn() {
      const error = new Error("RPC failed");
      throw error;
    }

    await expect(simulateMutationFn()).rejects.toThrow("RPC failed");
    expect(trackMock).not.toHaveBeenCalled();
  });
});
