/**
 * Performance Metrics — Unit Tests
 *
 * Run: npx vitest src/services/dev/__tests__/performanceMetrics.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordPerf,
  getPerfEntries,
  clearPerfEntries,
  getAggregatedMetrics,
  measureSync,
} from "../performanceMetrics";

beforeEach(() => {
  clearPerfEntries();
});

describe("recordPerf", () => {
  it("records a performance entry", () => {
    recordPerf("test-op", 0, 10);
    const entries = getPerfEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].label).toBe("test-op");
    expect(entries[0].durationMs).toBe(10);
  });

  it("stores metadata when provided", () => {
    recordPerf("test-op", 0, 5, { key: "value" });
    expect(getPerfEntries()[0].metadata).toEqual({ key: "value" });
  });
});

describe("clearPerfEntries", () => {
  it("clears all entries", () => {
    recordPerf("a", 0, 1);
    recordPerf("b", 0, 2);
    expect(getPerfEntries().length).toBe(2);
    clearPerfEntries();
    expect(getPerfEntries().length).toBe(0);
  });
});

describe("getAggregatedMetrics", () => {
  it("aggregates multiple entries by label", () => {
    recordPerf("op", 0, 10);
    recordPerf("op", 0, 20);
    recordPerf("op", 0, 30);

    const metrics = getAggregatedMetrics();
    expect(metrics["op"]).toBeDefined();
    expect(metrics["op"].count).toBe(3);
    expect(metrics["op"].avgMs).toBe(20);
    expect(metrics["op"].minMs).toBe(10);
    expect(metrics["op"].maxMs).toBe(30);
  });

  it("separates different labels", () => {
    recordPerf("a", 0, 10);
    recordPerf("b", 0, 20);

    const metrics = getAggregatedMetrics();
    expect(Object.keys(metrics)).toHaveLength(2);
    expect(metrics["a"].count).toBe(1);
    expect(metrics["b"].count).toBe(1);
  });
});

describe("measureSync", () => {
  it("records timing for sync function", () => {
    const result = measureSync("sync-op", () => 42);
    expect(result).toBe(42);
    expect(getPerfEntries()).toHaveLength(1);
    expect(getPerfEntries()[0].label).toBe("sync-op");
  });

  it("records error flag on thrown exception", () => {
    expect(() =>
      measureSync("failing-op", () => {
        throw new Error("fail");
      })
    ).toThrow("fail");

    expect(getPerfEntries()).toHaveLength(1);
    expect(getPerfEntries()[0].metadata?.error).toBe(true);
  });
});
