import { describe, expect, it } from "vitest";
import {
  sourceUrlRemoveTarget,
  sourceUrlSaveIntent,
} from "@/lib/knowledge/knowledgeSourceUrlEdit";

describe("source URL edit intents", () => {
  it("updates a linked source in place", () => {
    expect(sourceUrlSaveIntent({ editingId: "src-1", previousUrl: "https://old.example" })).toEqual({
      kind: "update",
      sourceId: "src-1",
    });
  });

  it("replaces a provenance-only URL instead of adding a second source", () => {
    expect(
      sourceUrlSaveIntent({ editingId: "new", previousUrl: "https://www.hse.gov.uk/old" })
    ).toEqual({
      kind: "replace",
      previousUrl: "https://www.hse.gov.uk/old",
    });
  });

  it("adds only when there is no existing URL to replace", () => {
    expect(sourceUrlSaveIntent({ editingId: "new" })).toEqual({ kind: "add" });
  });

  it("can remove a linked or orphan URL", () => {
    expect(sourceUrlRemoveTarget({ id: "src-1", url: "https://a.example" })).toEqual({
      sourceId: "src-1",
      url: "https://a.example",
    });
    expect(sourceUrlRemoveTarget({ url: "https://orphan.example" })).toEqual({
      sourceId: null,
      url: "https://orphan.example",
    });
    expect(sourceUrlRemoveTarget({})).toBeNull();
  });
});
