import { describe, expect, it } from "vitest";
import {
  findTestPersona,
  findTestPersonaByEmail,
  TEST_PERSONAS,
} from "@/lib/dev/testPersonas";

describe("testPersonas", () => {
  it("defines six stable test IDs", () => {
    expect(TEST_PERSONAS).toHaveLength(6);
    expect(TEST_PERSONAS.map((p) => p.testId)).toEqual([
      "TEST-01",
      "TEST-02",
      "TEST-03",
      "TEST-04",
      "TEST-05",
      "TEST-06",
    ]);
  });

  it("includes Emma and Frank as new personas", () => {
    expect(findTestPersona("test-05")?.label).toBe("Emma Technician");
    expect(findTestPersona("test-06")?.label).toBe("Frank Vendor");
  });

  it("finds persona by email case-insensitively", () => {
    expect(findTestPersonaByEmail("JustinPlunkett+Carol@Gmail.com")?.testId).toBe(
      "TEST-03"
    );
  });
});
