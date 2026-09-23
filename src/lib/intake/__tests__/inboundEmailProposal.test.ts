import { describe, expect, it } from "vitest";
import { inspectInboundAttachment } from "../../../../supabase/functions/_shared/inboundAttachmentGuard.ts";
import {
  envelopeRecipientAddresses,
  validateInboundEmailProposal,
} from "../../../../supabase/functions/_shared/inboundEmailTriage.ts";
import {
  EXTERNAL_SENDER_LABEL,
  inboundEmailOutcomeLabel,
  inboundEmailSenderLabel,
} from "../inboundEmailProposal";

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);

describe("personal inbound email safeguards", () => {
  it("routes only from webhook recipient fields", () => {
    const envelope = envelopeRecipientAddresses({
      to: ["Person <me+abc@inbox.filla.app>"],
      cc: ["ME+ABC@inbox.filla.app", "other@example.com"],
      bcc: ["hidden+token@inbox.filla.app"],
    });
    expect(envelope).toEqual([
      "me+abc@inbox.filla.app",
      "other@example.com",
      "hidden+token@inbox.filla.app",
    ]);
    expect(
      envelopeRecipientAddresses({
        to: ["kept@inbox.filla.app"],
      })
    ).not.toContain("forged-header@inbox.filla.app");
  });

  it("keeps a reminder as a task and rejects knowledge without evidence", () => {
    const reminder = validateInboundEmailProposal({
      outcome: "task",
      confidence: 0.8,
      suggested_title: "Call the boiler engineer",
      summary: "They asked for a visit next Tuesday.",
      task_fields: { reminder: true, due_date: "2026-09-29", priority: "normal" },
      knowledge_scope: "platform",
      reasoning_summary: "A dated follow-up.",
      evidence_references: ["visit next Tuesday"],
    });
    expect(reminder.outcome).toBe("task");
    expect(reminder.task_fields?.reminder).toBe(true);
    expect(reminder.task_fields?.due_date).toBe("2026-09-29");
    expect(reminder.knowledge_scope).toBeNull();
    expect(inboundEmailOutcomeLabel(reminder)).toBe("Suggested reminder");

    const chatter = validateInboundEmailProposal({
      outcome: "knowledge",
      confidence: 2,
      suggested_title: "Boiler chat",
      summary: "We talked about the boiler.",
      knowledge_scope: "platform",
      reasoning_summary: "Mentions a property system.",
      evidence_references: [],
    });
    expect(chatter.outcome).toBe("unclear");
    expect(chatter.knowledge_scope).toBeNull();
    expect(chatter.confidence).toBe(1);
  });

  it("accepts organisation knowledge only with a cited passage", () => {
    const guidance = validateInboundEmailProposal({
      outcome: "knowledge",
      confidence: 0.7,
      suggested_title: "Annual gas safety is required",
      summary: "Landlords must hold a current record.",
      knowledge_scope: "organisation",
      reasoning_summary: "Reusable compliance guidance.",
      evidence_references: ["must hold a current gas safety record"],
    });
    expect(guidance.outcome).toBe("knowledge");
    expect(guidance.knowledge_scope).toBe("organisation");
  });

  it("labels an unverified sender and rejects active or mismatched files", () => {
    expect(
      inboundEmailSenderLabel({
        channel: "member_intake_email",
        sender_verified: false,
        authorship: "external",
      })
    ).toBe(EXTERNAL_SENDER_LABEL);
    expect(
      inboundEmailSenderLabel({
        channel: "member_intake_email",
        sender_verified: true,
        authorship: "member",
      })
    ).toBeNull();

    expect(
      inspectInboundAttachment({
        fileName: "note.pdf",
        declaredMime: "application/pdf",
        bytes: pdf,
      }).ok
    ).toBe(true);
    expect(
      inspectInboundAttachment({
        fileName: "note.pdf",
        declaredMime: "application/pdf",
        bytes: exe,
      })
    ).toEqual({ ok: false, reason: "executable_content" });
    expect(
      inspectInboundAttachment({
        fileName: "page.html",
        declaredMime: "text/plain",
        bytes: new TextEncoder().encode("<html><script>alert(1)</script>"),
      })
    ).toEqual({ ok: false, reason: "blocked_extension" });
  });
});
