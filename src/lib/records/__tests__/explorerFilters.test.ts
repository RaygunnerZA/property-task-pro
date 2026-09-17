import { describe, expect, it } from "vitest";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import {
  EXPLORER_CATEGORY_ORDER,
  describeEmptyExplorerState,
  filterExplorerDocuments,
  matchesExplorerCategory,
  matchesExplorerLocation,
  documentHasMissingInfo,
} from "../explorerFilters";

function doc(partial: Partial<PropertyDocument> & { id: string }): PropertyDocument {
  return {
    file_url: "",
    file_name: null,
    file_type: null,
    file_size: null,
    thumbnail_url: null,
    title: null,
    category: null,
    document_type: null,
    expiry_date: null,
    renewal_frequency: null,
    status: null,
    notes: null,
    created_at: "",
    updated_at: "",
    linked_spaces: [],
    ...partial,
  };
}

describe("explorerFilters", () => {
  it("orders categories discovery-first", () => {
    expect(EXPLORER_CATEGORY_ORDER.slice(0, 6)).toEqual([
      "all",
      "compliance",
      "Plans",
      "Warranties",
      "O&M Manuals",
      "Contractors",
    ]);
    expect(EXPLORER_CATEGORY_ORDER.at(-1)).toBe("uncategorised");
  });

  it("intersects category and location independently", () => {
    const docs = [
      doc({
        id: "1",
        title: "Gas cert",
        category: "Fire Safety",
        linked_spaces: [{ id: "kitchen", name: "Kitchen" }],
      }),
      doc({
        id: "2",
        title: "Lease",
        category: "Legal",
        linked_spaces: [{ id: "kitchen", name: "Kitchen" }],
      }),
      doc({
        id: "3",
        title: "EICR",
        category: "Electrical",
        linked_spaces: [],
      }),
    ];

    expect(matchesExplorerCategory(docs[0], "compliance")).toBe(true);
    expect(matchesExplorerCategory(docs[1], "compliance")).toBe(false);

    const filtered = filterExplorerDocuments(docs, {
      category: "compliance",
      location: { kind: "space", spaceId: "kitchen" },
      attention: "all",
      search: "",
    });
    expect(filtered.map((d) => d.id)).toEqual(["1"]);
  });

  it("treats property-level as no space links", () => {
    const d = doc({ id: "1", title: "Policy", category: "Insurance" });
    expect(matchesExplorerLocation(d, { kind: "property-level" })).toBe(true);
    expect(
      matchesExplorerLocation(
        { ...d, linked_spaces: [{ id: "a", name: "A" }] },
        { kind: "property-level" }
      )
    ).toBe(false);
  });

  it("flags missing metadata separately from missing evidence", () => {
    expect(documentHasMissingInfo(doc({ id: "1", title: null, category: null }))).toBe(
      true
    );
    expect(
      documentHasMissingInfo(doc({ id: "2", title: "Named", category: "Plans" }))
    ).toBe(false);
  });

  it("filters by area via nested space ids", () => {
    const docs = [
      doc({
        id: "1",
        title: "A",
        category: "Plans",
        linked_spaces: [{ id: "k", name: "Kitchen" }],
      }),
      doc({
        id: "2",
        title: "B",
        category: "Plans",
        linked_spaces: [{ id: "bath", name: "Bath" }],
      }),
    ];
    const filtered = filterExplorerDocuments(docs, {
      category: "all",
      location: { kind: "area", areaId: "ground", spaceIds: ["k", "hall"] },
      attention: "all",
      search: "",
    });
    expect(filtered.map((d) => d.id)).toEqual(["1"]);
  });

  it("names empty states from active filters", () => {
    expect(
      describeEmptyExplorerState({
        category: "Plans",
        location: { kind: "space", spaceId: "roof" },
        locationLabel: "Roof",
      })
    ).toBe("No Plans are filed to Roof");
  });
});
