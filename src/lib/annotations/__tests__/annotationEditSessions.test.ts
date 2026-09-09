import { describe, expect, it } from "vitest";
import type { Annotation, TextAnnotation } from "@/types/image-annotations";
import {
  groupAnnotationsByAuthor,
  isPersistedAnnotationLayerId,
  splitEditSessionsByAuthor,
  winningSessionIdByAnnotation,
  type AnnotationLayerSession,
} from "@/lib/annotations/annotationEditSessions";

function text(partial: Partial<TextAnnotation> & Pick<TextAnnotation, "annotationId">): TextAnnotation {
  return {
    version: 1,
    type: "text",
    x: 0.1,
    y: 0.1,
    width: 0.2,
    text: partial.text ?? "note",
    textColor: "charcoal",
    background: "none",
    strokeColor: "charcoal",
    strokeWidth: "medium",
    ...partial,
  };
}

const justin = "11111111-1111-1111-1111-111111111111";
const mathew = "22222222-2222-2222-2222-222222222222";

describe("groupAnnotationsByAuthor", () => {
  it("splits Justin and Mathew marks into separate groups", () => {
    const groups = groupAnnotationsByAuthor(
      [
        text({ annotationId: "a", createdBy: justin, text: "mine" }),
        text({ annotationId: "b", createdBy: mathew, text: "mathew" }),
      ],
      justin,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].userId).toBe(justin);
    expect(groups[0].annotations.map((a) => a.annotationId)).toEqual(["a"]);
    expect(groups[1].userId).toBe(mathew);
    expect(groups[1].annotations.map((a) => a.annotationId)).toEqual(["b"]);
  });

  it("keeps unauthored marks with the session owner", () => {
    const groups = groupAnnotationsByAuthor(
      [
        text({ annotationId: "old", text: "legacy" }),
        text({ annotationId: "b", createdBy: mathew, text: "mathew" }),
      ],
      justin,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].userId).toBe(justin);
    expect(groups[0].annotations.map((a) => a.annotationId)).toEqual(["old"]);
    expect(groups[1].userId).toBe(mathew);
  });
});

describe("splitEditSessionsByAuthor", () => {
  const resolve = (userId: string | null) => ({
    name: userId === mathew ? "Mathew" : userId === justin ? "Justin" : "Teammate",
    avatarUrl: null,
  });

  it("explodes a mixed baseline blob into stacked author cards", () => {
    const baseline: AnnotationLayerSession = {
      id: "baseline",
      createdAt: "2026-09-09T08:00:00.000Z",
      userId: justin,
      userDisplayName: "Justin",
      userAvatarUrl: null,
      versionNumber: 0,
      label: "Edit by Justin",
      annotations: [
        text({ annotationId: "a", createdBy: justin }),
        text({ annotationId: "b", createdBy: mathew }),
      ],
      isEnabled: true,
    };

    const split = splitEditSessionsByAuthor([baseline], resolve);
    expect(split).toHaveLength(2);
    expect(split.map((s) => s.userDisplayName)).toEqual(["Justin", "Mathew"]);
    expect(split[0].id).toBe(`baseline:${justin}`);
    expect(split[1].id).toBe(`baseline:${mathew}`);
    expect(split.every((s) => s.persistId == null)).toBe(true);
  });

  it("leaves already-separate layers alone", () => {
    const sessions: AnnotationLayerSession[] = [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        createdAt: "2026-09-09T08:00:00.000Z",
        userId: justin,
        userDisplayName: "Justin",
        userAvatarUrl: null,
        versionNumber: 1,
        label: "Edit 1",
        persistId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        annotations: [text({ annotationId: "a", createdBy: justin })],
        isEnabled: true,
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        createdAt: "2026-09-09T08:05:00.000Z",
        userId: mathew,
        userDisplayName: "Mathew",
        userAvatarUrl: null,
        versionNumber: 2,
        label: "Edit 2",
        persistId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        annotations: [text({ annotationId: "b", createdBy: mathew })],
        isEnabled: true,
      },
    ];

    expect(splitEditSessionsByAuthor(sessions, resolve)).toEqual(sessions);
  });
});

describe("isPersistedAnnotationLayerId", () => {
  it("accepts version row ids and rejects baseline/legacy cards", () => {
    expect(isPersistedAnnotationLayerId("cccccccc-cccc-4ccc-8ccc-cccccccccccc")).toBe(true);
    expect(isPersistedAnnotationLayerId("baseline")).toBe(false);
    expect(isPersistedAnnotationLayerId("baseline:11111111-1111-1111-1111-111111111111")).toBe(false);
    expect(isPersistedAnnotationLayerId("legacy-json")).toBe(false);
  });
});

describe("winningSessionIdByAnnotation", () => {
  it("lets a later layer replace the same shape id", () => {
    const sessions = [
      {
        id: "one",
        isEnabled: true,
        annotations: [text({ annotationId: "shared", createdBy: justin }) as Annotation],
      },
      {
        id: "two",
        isEnabled: true,
        annotations: [text({ annotationId: "shared", text: "updated", createdBy: justin }) as Annotation],
      },
    ];
    const winner = winningSessionIdByAnnotation(sessions);
    expect(winner.get("shared")).toBe("two");
  });
});
