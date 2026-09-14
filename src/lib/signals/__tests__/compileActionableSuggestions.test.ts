import { describe, expect, it } from "vitest";
import {
  compileActionableSuggestions,
  suggestionFingerprint,
} from "@/lib/signals/compileActionableSuggestions";
import type {
  ActionableSuggestion,
  SuggestionCompileContext,
  SuggestionDocument,
  SuggestionTask,
} from "@/lib/signals/actionableSuggestionTypes";

const NOW = new Date("2026-09-13T12:00:00.000Z");

function task(partial: Partial<SuggestionTask> & { id: string }): SuggestionTask {
  return {
    title: "Task",
    status: "open",
    property_id: "prop-1",
    property_name: "Hall",
    created_at: "2026-09-01T12:00:00.000Z",
    ...partial,
  };
}

function doc(partial: Partial<SuggestionDocument> & { id: string }): SuggestionDocument {
  return {
    title: "Gas safety certificate",
    document_type: "Gas",
    property_id: "prop-1",
    property_name: "Hall",
    expiry_date: "2026-10-22",
    ...partial,
  };
}

function ctx(overrides: Partial<SuggestionCompileContext> = {}): SuggestionCompileContext {
  return {
    now: NOW,
    currentUserId: "user-me",
    role: "manager",
    assignedPropertyIds: null,
    tasks: [],
    documents: [],
    signals: [],
    taskAssetLinks: [],
    assets: [],
    messagesByTaskId: {},
    membersByUserId: { "user-me": { name: "Alex", role: "manager" } },
    userState: {},
    ...overrides,
  };
}

function kinds(suggestions: ActionableSuggestion[]) {
  return suggestions.map((item) => item.kind);
}

describe("compileActionableSuggestions", () => {
  it("suggests planning renewal when a certificate is expiring and no renewal task is linked", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        documents: [doc({ id: "doc-1", expiry_date: "2026-10-22" })],
        tasks: [task({ id: "t-garden", title: "Mow the lawn" })],
      })
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.headline).toBe("Plan this certificate renewal");
    expect(suggestions[0]?.message).toContain("expires in 39 days");
    expect(suggestions[0]?.message).toContain("No renewal task is linked");
    expect(suggestions[0]?.action.label).toBe("Plan renewal");
    expect(suggestions[0]?.action.kind).toBe("open_record");
  });

  it("prioritises an expired certificate with no renewal work over generic open work", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        documents: [doc({ id: "doc-expired", expiry_date: "2026-08-01" })],
        tasks: [task({ id: "t-urgent", title: "Paint the hall", priority: "urgent" })],
      })
    );
    expect(suggestions[0]?.kind).toBe("certificate_expiry");
    expect(suggestions[0]?.message).toContain("expired");
    expect(suggestions[0]?.message).toContain("No renewal task is linked");
  });

  it("does not suggest renewal when matching renewal work already exists", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        documents: [doc({ id: "doc-1", expiry_date: "2026-10-22" })],
        tasks: [
          task({
            id: "t-renew",
            title: "Renew gas safety certificate",
            is_compliance: true,
            status: "open",
          }),
        ],
      })
    );
    expect(kinds(suggestions)).not.toContain("certificate_expiry");
  });

  it("does not emit generic overdue-count advice", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t1",
            title: "Paint the hall",
            due_date: "2026-08-01",
            priority: "urgent",
            status: "open",
            assigned_user_id: "user-me",
          }),
          task({
            id: "t2",
            title: "Replace bulbs",
            due_date: "2026-08-02",
            status: "in_progress",
            assigned_user_id: "user-me",
            priority: "urgent",
          }),
        ],
      })
    );
    expect(suggestions).toEqual([]);
  });

  it("asks to review access details when a contractor is waiting", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-access",
            title: "Boiler repair",
            assigned_vendor_name: "HeatCo",
            description: "Engineer waiting for access",
          }),
        ],
      })
    );
    expect(suggestions[0]?.kind).toBe("waiting_access");
    expect(suggestions[0]?.action.label).toBe("Review access details");
    expect(suggestions[0]?.message).toContain("waiting for access details");
  });

  it("does not suggest access review after a later confirmation", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-access",
            title: "Boiler repair",
            assigned_vendor_name: "HeatCo",
            description: "Engineer waiting for access",
            created_at: "2026-09-10T10:00:00.000Z",
          }),
        ],
        messagesByTaskId: {
          "t-access": [
            {
              taskId: "t-access",
              body: "Still waiting for access keys",
              createdAt: "2026-09-11T10:00:00.000Z",
            },
            {
              taskId: "t-access",
              body: "Access confirmed — keys left in the porch",
              createdAt: "2026-09-12T10:00:00.000Z",
            },
          ],
        },
      })
    );
    expect(kinds(suggestions)).not.toContain("waiting_access");
  });

  it("still suggests access review for urgent in-progress work that is blocked", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-access",
            title: "Urgent boiler repair",
            status: "in_progress",
            priority: "urgent",
            assigned_user_id: "user-me",
            assigned_vendor_name: "HeatCo",
            description: "Contractor waiting for access",
          }),
        ],
      })
    );
    expect(suggestions[0]?.kind).toBe("waiting_access");
  });

  it("links a new leak report to an existing open repair", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-old",
            title: "Kitchen leak repair",
            created_at: "2026-08-01T12:00:00.000Z",
            asset_ids: ["asset-pipe"],
          }),
          task({
            id: "t-new",
            title: "Kitchen leak reported again",
            created_at: "2026-09-12T12:00:00.000Z",
            asset_ids: ["asset-pipe"],
          }),
        ],
        taskAssetLinks: [
          { taskId: "t-old", assetId: "asset-pipe" },
          { taskId: "t-new", assetId: "asset-pipe" },
        ],
      })
    );
    const duplicate = suggestions.find((item) => item.kind === "duplicate_report");
    expect(duplicate?.action.label).toBe("Compare repairs");
    expect(duplicate?.action.taskId).toBe("t-old");
    expect(duplicate?.message).toContain("Kitchen leak repair");
    expect(duplicate?.confidence).toBe("observed");
  });

  it("does not treat unrelated open work as a matching repair", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-old",
            title: "Layout issue in the time box",
            created_at: "2026-08-01T12:00:00.000Z",
          }),
          task({
            id: "t-new",
            title: "Annotation window menu issue",
            created_at: "2026-09-12T12:00:00.000Z",
          }),
        ],
      })
    );
    expect(kinds(suggestions)).not.toContain("duplicate_report");
  });

  it("does not match a boiler fault to an unrelated UI bug that says not working", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-old",
            title: "Plumbing issue boiler Justin look",
            created_at: "2026-08-01T12:00:00.000Z",
          }),
          task({
            id: "t-new",
            title: "Annotation Issue - Still not working correctly",
            created_at: "2026-09-12T12:00:00.000Z",
          }),
        ],
      })
    );
    expect(kinds(suggestions)).not.toContain("duplicate_report");
  });

  it("does not match faults on contradictory assets or locations", () => {
    const differentAssets = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-old",
            title: "Kitchen leak repair",
            created_at: "2026-08-01T12:00:00.000Z",
            asset_ids: ["pipe-a"],
          }),
          task({
            id: "t-new",
            title: "Kitchen leak reported again",
            created_at: "2026-09-12T12:00:00.000Z",
            asset_ids: ["pipe-b"],
          }),
        ],
        taskAssetLinks: [
          { taskId: "t-old", assetId: "pipe-a" },
          { taskId: "t-new", assetId: "pipe-b" },
        ],
      })
    );
    expect(kinds(differentAssets)).not.toContain("duplicate_report");

    const differentRooms = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-old",
            title: "Kitchen boiler heating fault",
            created_at: "2026-08-01T12:00:00.000Z",
          }),
          task({
            id: "t-new",
            title: "Bathroom boiler heating fault",
            created_at: "2026-09-12T12:00:00.000Z",
          }),
        ],
      })
    );
    expect(kinds(differentRooms)).not.toContain("duplicate_report");
  });

  it("uses Check possible duplicate wording when an asset match is uncertain", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-old",
            title: "Lounge heating repair",
            created_at: "2026-08-01T12:00:00.000Z",
          }),
          task({
            id: "t-new",
            title: "Lounge heating fault reported",
            created_at: "2026-09-12T12:00:00.000Z",
          }),
        ],
      })
    );
    const duplicate = suggestions.find((item) => item.kind === "duplicate_report");
    expect(duplicate?.confidence).toBe("qualified");
    expect(duplicate?.headline).toBe("Check a possible duplicate");
    expect(duplicate?.message).toBe("This may relate to ‘Lounge heating repair’.");
    expect(duplicate?.action.label).toBe("Compare repairs");
  });

  it("opens the inspection when a certificate is missing rather than promising a request", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-inspect",
            title: "Annual gas inspection",
            status: "completed",
            is_compliance: true,
            completed_at: "2026-09-10T12:00:00.000Z",
            images: [],
          }),
        ],
      })
    );
    expect(suggestions[0]?.kind).toBe("missing_certificate");
    expect(suggestions[0]?.action.label).toBe("Review inspection");
    expect(suggestions[0]?.message).toContain("hasn’t been attached");
  });

  it("does not request a certificate when one is already attached", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-inspect",
            title: "Annual gas inspection",
            status: "completed",
            is_compliance: true,
            completed_at: "2026-09-10T12:00:00.000Z",
            images: [{ file_name: "gas-certificate.pdf", file_type: "application/pdf" }],
          }),
        ],
      })
    );
    expect(kinds(suggestions)).not.toContain("missing_certificate");
  });

  it("counts repeated faults only when asset links support the relationship", () => {
    const linked = compileActionableSuggestions(
      ctx({
        assets: [{ id: "boiler-1", name: "Boiler", property_id: "prop-1" }],
        taskAssetLinks: [
          { taskId: "a", assetId: "boiler-1" },
          { taskId: "b", assetId: "boiler-1" },
          { taskId: "c", assetId: "boiler-1" },
        ],
        tasks: [
          task({ id: "a", title: "Boiler heating fault", created_at: "2026-04-01T00:00:00.000Z" }),
          task({ id: "b", title: "Heating repair", created_at: "2026-06-01T00:00:00.000Z" }),
          task({ id: "c", title: "Boiler not working", created_at: "2026-09-01T00:00:00.000Z" }),
        ],
      })
    );
    expect(linked[0]?.kind).toBe("repeated_fault");
    expect(linked[0]?.message).toContain("third heating fault");
    expect(linked[0]?.action.label).toBe("Review history");

    const unlinked = compileActionableSuggestions(
      ctx({
        tasks: [
          task({ id: "a", title: "Boiler heating fault", created_at: "2026-04-01T00:00:00.000Z" }),
          task({ id: "b", title: "Heating repair", created_at: "2026-06-01T00:00:00.000Z" }),
          task({ id: "c", title: "Boiler not working", created_at: "2026-09-01T00:00:00.000Z" }),
        ],
      })
    );
    expect(kinds(unlinked)).not.toContain("repeated_fault");
  });

  it("flags a booked visit with no tenant notification recorded", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-visit",
            title: "Engineer visit booked",
            due_date: "2026-09-17",
          }),
        ],
      })
    );
    expect(suggestions[0]?.kind).toBe("tenant_notification");
    expect(suggestions[0]?.message).toContain("No tenant notification is recorded in Filla");
    expect(suggestions[0]?.action.label).toBe("Review tenant update");
  });

  it("does not treat an internal mention of the tenant as a sent update", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-visit",
            title: "Engineer visit booked",
            due_date: "2026-09-17",
          }),
        ],
        messagesByTaskId: {
          "t-visit": [
            {
              taskId: "t-visit",
              body: "Check with the tenant about parking",
              createdAt: "2026-09-12T00:00:00.000Z",
              direction: "outbound",
            },
          ],
        },
      })
    );
    expect(suggestions[0]?.kind).toBe("tenant_notification");
  });

  it("does not flag a visit when a tenant notification was sent", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-visit",
            title: "Engineer visit booked",
            due_date: "2026-09-17",
          }),
        ],
        messagesByTaskId: {
          "t-visit": [
            {
              taskId: "t-visit",
              body: "SMS sent to the tenant about Thursday visit",
              createdAt: "2026-09-12T00:00:00.000Z",
              direction: "outbound",
              source: "sms",
            },
          ],
        },
      })
    );
    expect(kinds(suggestions)).not.toContain("tenant_notification");
  });

  it("does not flag a cancelled visit for tenant notification", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-visit",
            title: "Engineer visit booked — cancelled",
            due_date: "2026-09-17",
            description: "Visit cancelled by contractor",
          }),
        ],
      })
    );
    expect(kinds(suggestions)).not.toContain("tenant_notification");
  });

  it("does not suggest a second urgency reminder for work that is already progressing", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        tasks: [
          task({
            id: "t-urgent",
            title: "Urgent boiler repair",
            status: "in_progress",
            priority: "urgent",
            assigned_user_id: "user-me",
          }),
        ],
      })
    );
    expect(suggestions).toEqual([]);
  });

  it("does not recommend external email just because the sender is outside the org", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        signals: [
          {
            id: "sig-1",
            kind: "email",
            subtype: "ingestion.external_email",
            severity: "info",
            title: "Newsletter",
            body: "Monthly round-up from the trade association.",
            disposition: "needs_review",
            payload: { from: "news@example.com", subject: "Newsletter", preview: "Monthly round-up" },
            created_at: "2026-09-12T12:00:00.000Z",
            property_id: "prop-1",
          },
        ],
      })
    );
    expect(kinds(suggestions)).not.toContain("external_email");
  });

  it("recommends reviewing an external email when it asks for a decision", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        signals: [
          {
            id: "sig-2",
            kind: "email",
            subtype: "ingestion.external_email",
            severity: "info",
            title: "Quote approval",
            body: "Please approve the attached quote for the boiler repair.",
            disposition: "needs_review",
            payload: {
              from: "heatco@example.com",
              subject: "Quote for boiler",
              preview: "Please approve the attached quote",
            },
            created_at: "2026-09-12T12:00:00.000Z",
            property_id: "prop-1",
          },
        ],
      })
    );
    expect(suggestions[0]?.kind).toBe("external_email");
    expect(suggestions[0]?.action.label).toBe("Review request");
    expect(suggestions[0]?.headline).toBe("Review this inbound request");
  });

  it("keeps snoozed unchanged suggestions hidden until the snooze ends", () => {
    const base = ctx({
      documents: [doc({ id: "doc-1", expiry_date: "2026-10-22" })],
    });
    const open = compileActionableSuggestions(base);
    expect(open).toHaveLength(1);
    const hidden = compileActionableSuggestions({
      ...base,
      userState: {
        "certificate-expiry:doc-1": {
          snoozedUntil: "2026-09-14T12:00:00.000Z",
          fingerprint: suggestionFingerprint(open[0]!),
        },
      },
    });
    expect(hidden).toEqual([]);
  });

  it("hides suggestions for properties the current staff member cannot access", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        role: "staff",
        assignedPropertyIds: ["prop-2"],
        documents: [doc({ id: "doc-1", property_id: "prop-1", expiry_date: "2026-10-22" })],
      })
    );
    expect(suggestions).toEqual([]);
  });

  it("returns nothing when there is no useful next step", () => {
    expect(compileActionableSuggestions(ctx())).toEqual([]);
  });

  it("does not recommend operational action on seeded sample records", () => {
    const suggestions = compileActionableSuggestions(
      ctx({
        documents: [
          doc({
            id: "doc-sample",
            title: "Water System Inspection (sample)",
            expiry_date: "2026-08-22",
          }),
        ],
        tasks: [
          task({
            id: "t-sample",
            title: "Gas Safety Certificate (sample)",
            description: "Shows a renewal. [onboarding_demo]",
            assigned_vendor_name: "HeatCo",
          }),
        ],
      })
    );
    expect(suggestions).toEqual([]);
  });
});
