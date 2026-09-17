import { describe, expect, it } from "vitest";
import {
  documentDisplayTitle,
  filedToastMessage,
  filingDropOverlayLabel,
  isPropertyLevelDocument,
  reconcileSpaceLinks,
  removedLinkToastMessage,
  spaceIdsToAdd,
} from "../attachmentSpaces";

describe("attachmentSpaces filing helpers", () => {
  it("prefers human title over filename", () => {
    expect(
      documentDisplayTitle({ title: "Gas safety", file_name: "scan_001.pdf" })
    ).toBe("Gas safety");
    expect(documentDisplayTitle({ title: null, file_name: "scan_001.pdf" })).toBe(
      "scan_001"
    );
    expect(documentDisplayTitle({ title: "  ", file_name: null })).toBe(
      "Untitled document"
    );
  });

  it("treats empty linked_spaces as property level", () => {
    expect(isPropertyLevelDocument({})).toBe(true);
    expect(isPropertyLevelDocument({ linked_spaces: [] })).toBe(true);
    expect(
      isPropertyLevelDocument({ linked_spaces: [{ id: "s1", name: "Kitchen" }] })
    ).toBe(false);
  });

  it("adds a second space without dropping the first", () => {
    expect(spaceIdsToAdd(["kitchen"], "living")).toEqual(["living"]);
    expect(spaceIdsToAdd(["kitchen", "living"], "kitchen")).toEqual([]);
  });

  it("reconciles multi-select File to… without inventing moves", () => {
    expect(reconcileSpaceLinks(["a", "b"], ["a", "c"])).toEqual({
      add: ["c"],
      remove: ["b"],
    });
    expect(reconcileSpaceLinks(["a"], ["a"])).toEqual({ add: [], remove: [] });
    expect(reconcileSpaceLinks([], ["a", "b"])).toEqual({
      add: ["a", "b"],
      remove: [],
    });
  });

  it("uses File / Filed wording, not Move", () => {
    expect(filingDropOverlayLabel("Kitchen", false)).toBe("File to Kitchen");
    expect(filingDropOverlayLabel(null, true)).toBe("Keep at property level");
    expect(filedToastMessage("Kitchen")).toBe("Filed to Kitchen");
    expect(removedLinkToastMessage("Kitchen")).toBe("Removed Kitchen link");
  });
});
