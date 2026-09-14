import { describe, it, expect } from "vitest";
import {
  GENERIC_TASK_ILLUSTRATION_POOL,
  getTaskSpaceIllustration,
  pickGenericTaskIllustration,
  resolveTaskDisplayImageUrl,
} from "@/lib/taskIllustration";

describe("getTaskSpaceIllustration", () => {
  it("resolves the boiler room space name to boiler-room mini-card art", () => {
    expect(
      getTaskSpaceIllustration([{ name: "the boiler room" }], "Check the Temperature")
    ).toBe("/spaces/mini-cards/boiler-room.png");
  });

  it("resolves canonical Boiler Room space type labels", () => {
    expect(getTaskSpaceIllustration([{ spaceTypeName: "Boiler Room" }])).toBe(
      "/spaces/mini-cards/boiler-room.png"
    );
  });

  it("uses title hints when no space illustration resolves", () => {
    expect(getTaskSpaceIllustration([], "Check the Temperature")).toBe(
      "/spaces/mini-cards/boiler-room.png"
    );
  });

  it("prefers linked space over title hints", () => {
    expect(
      getTaskSpaceIllustration([{ name: "Kitchen" }], "Check boiler temperature")
    ).toBe("/spaces/mini-cards/kitchen.png");
  });

  it("matches gate from the task title when no space is linked", () => {
    expect(getTaskSpaceIllustration([], "Fix the gate")).toBe(
      "/spaces/mini-cards/exterior-gate.png"
    );
  });

  it("matches floor-plan and asset titles to related scenes", () => {
    expect(getTaskSpaceIllustration([], "Unable to upload floor plan")).toBe(
      "/spaces/mini-cards/building-exterior.png"
    );
    expect(getTaskSpaceIllustration([], "After adding an asset")).toBe(
      "/spaces/mini-cards/workshop.png"
    );
  });
});

describe("resolveTaskDisplayImageUrl", () => {
  it("keeps uploaded photos ahead of illustrations", () => {
    expect(
      resolveTaskDisplayImageUrl(
        {
          id: "t1",
          title: "Fix the gate",
          image_url: "https://cdn.example/gate.jpg",
        },
        "Fix the gate"
      )
    ).toBe("https://cdn.example/gate.jpg");
  });

  it("still uses office art when the linked space is an office", () => {
    expect(
      resolveTaskDisplayImageUrl(
        { id: "t2", title: "Desk move", spaces: [{ name: "Office" }] },
        "Desk move"
      )
    ).toBe("/spaces/mini-cards/office.png");
  });

  it("does not collapse unmatched tasks onto office.png", () => {
    const urls = ["How do create repeat tasks", "Please review this", "Follow up"].map(
      (title, i) =>
        resolveTaskDisplayImageUrl({ id: `unmatched-${i}-${title}`, title }, title)
    );
    expect(urls.every((url) => url !== "/spaces/mini-cards/office.png")).toBe(true);
    expect(urls.every((url) => GENERIC_TASK_ILLUSTRATION_POOL.includes(url as typeof GENERIC_TASK_ILLUSTRATION_POOL[number]))).toBe(
      true
    );
    expect(new Set(urls).size).toBeGreaterThan(1);
  });

  it("picks a stable generic scene for the same task id", () => {
    const a = resolveTaskDisplayImageUrl({ id: "stable-task", title: "Please review this" });
    const b = resolveTaskDisplayImageUrl({ id: "stable-task", title: "Please review this" });
    expect(a).toBe(b);
    expect(a).toBe(pickGenericTaskIllustration("stable-task"));
  });
});
