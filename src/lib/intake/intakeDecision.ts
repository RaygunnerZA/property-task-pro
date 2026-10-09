/**
 * Decision Layer v1 — one next action, or one question.
 * Recommendations only. Callers still confirm before filing, creating, or dismissing.
 */

import type { IntakeDocumentBriefing } from "@/lib/intakeDocumentBriefing";
import type { InboundEmailProposal } from "../../../supabase/functions/_shared/inboundEmailTriage";

export type IntakeDecisionAction = "file_record" | "create_task" | "keep_knowledge";

export type IntakeDecisionConfidence = "sufficient" | "ambiguous" | "insufficient";

export type IntakeUnderstandingKind = "record" | "issue" | "knowledge" | "unknown";

export type IntakeEvidenceKind = "document" | "filename" | "inference" | "none";

export interface IntakeDecisionOption {
  id: string;
  label: string;
  action: IntakeDecisionAction | "something_else";
}

export interface IntakeDecision {
  recommended_action: IntakeDecisionAction | "ask";
  action_confidence: IntakeDecisionConfidence;
  reason: string;
  blocking_uncertainty: string | null;
  clarifying_question: string | null;
  clarifying_options: IntakeDecisionOption[];
  alternative_actions: IntakeDecisionAction[];
  understanding: {
    kind: IntakeUnderstandingKind;
    label: string | null;
    evidence: IntakeEvidenceKind;
  };
}

export interface DecideIntakeInput {
  briefing: IntakeDocumentBriefing;
  mimeType?: string | null;
  scanStillRunning?: boolean;
  /** Member email can be kept as organisation knowledge. */
  allowKnowledge?: boolean;
  proposal?: InboundEmailProposal | null;
}

const RECORD_ACTIONS: IntakeDecisionAction[] = ["file_record"];
const ISSUE_ACTIONS: IntakeDecisionAction[] = ["create_task"];

function withKnowledge(
  actions: IntakeDecisionAction[],
  allowKnowledge: boolean
): IntakeDecisionAction[] {
  if (!allowKnowledge || actions.includes("keep_knowledge")) return actions;
  return [...actions, "keep_knowledge"];
}

function article(label: string): string {
  return /^(eicr|epc|[aeiou])/i.test(label) ? "an" : "a";
}

function friendlyType(type: string | null): string | null {
  if (!type) return null;
  if (type === "Asbestos Management Survey") return "asbestos register";
  if (type === "EPC") return "energy performance certificate";
  return type;
}

function whatIsThisOptions(allowKnowledge: boolean): IntakeDecisionOption[] {
  const options: IntakeDecisionOption[] = [
    { id: "record", label: "A property document", action: "file_record" },
    { id: "issue", label: "Something that needs fixing", action: "create_task" },
  ];
  if (allowKnowledge) {
    options.push({ id: "knowledge", label: "Guidance to keep", action: "keep_knowledge" });
  }
  return options;
}

function askWhatThisIs(allowKnowledge: boolean, reason: string): IntakeDecision {
  return {
    recommended_action: "ask",
    action_confidence: "insufficient",
    reason,
    blocking_uncertainty: "what_this_is",
    clarifying_question: "What is this?",
    clarifying_options: whatIsThisOptions(allowKnowledge),
    alternative_actions: [],
    understanding: { kind: "unknown", label: null, evidence: "none" },
  };
}

function confirmType(
  label: string,
  evidence: IntakeEvidenceKind,
  reason: string,
  action: IntakeDecisionAction,
  allowKnowledge: boolean
): IntakeDecision {
  const friendly = friendlyType(label) || label;
  return {
    recommended_action: "ask",
    action_confidence: "ambiguous",
    reason,
    blocking_uncertainty: "classification",
    clarifying_question: `This looks like ${article(friendly)} ${friendly}. Is that right?`,
    clarifying_options: [
      { id: "yes", label: `Yes, ${friendly}`, action },
      { id: "else", label: "Something else", action: "something_else" },
    ],
    alternative_actions: withKnowledge(
      action === "file_record" ? ISSUE_ACTIONS : RECORD_ACTIONS,
      allowKnowledge
    ),
    understanding: {
      kind: action === "create_task" ? "issue" : action === "keep_knowledge" ? "knowledge" : "record",
      label,
      evidence,
    },
  };
}

function recommend(
  action: IntakeDecisionAction,
  label: string | null,
  evidence: IntakeEvidenceKind,
  reason: string,
  allowKnowledge: boolean
): IntakeDecision {
  const alternatives = withKnowledge(
    action === "file_record"
      ? ISSUE_ACTIONS
      : action === "create_task"
        ? RECORD_ACTIONS
        : RECORD_ACTIONS.concat(ISSUE_ACTIONS).filter((item) => item !== action),
    allowKnowledge
  ).filter((item) => item !== action);

  return {
    recommended_action: action,
    action_confidence: "sufficient",
    reason,
    blocking_uncertainty: null,
    clarifying_question: null,
    clarifying_options: [],
    alternative_actions: alternatives,
    understanding: {
      kind: action === "create_task" ? "issue" : action === "keep_knowledge" ? "knowledge" : "record",
      label,
      evidence,
    },
  };
}

/**
 * Choose the next intake action from an existing briefing.
 * Filename evidence never counts as a finished document read.
 */
export function decideIntake(input: DecideIntakeInput): IntakeDecision {
  const { briefing, scanStillRunning = false, allowKnowledge = false, proposal } = input;
  const mime = (input.mimeType || "").toLowerCase();
  const isPhoto = mime.startsWith("image/") || briefing.fileKindLabel === "Photo";
  const label = briefing.contentType || briefing.documentType;

  if (scanStillRunning && briefing.typeEvidence !== "document") {
    return {
      recommended_action: "ask",
      action_confidence: "insufficient",
      reason: "The document is still being read. The file name is not enough to decide.",
      blocking_uncertainty: "still_reading",
      clarifying_question: null,
      clarifying_options: [],
      alternative_actions: withKnowledge(["file_record", "create_task"], allowKnowledge),
      understanding: {
        kind: "unknown",
        label: briefing.typeEvidence === "filename" ? briefing.documentType : null,
        evidence: briefing.typeEvidence === "filename" ? "filename" : "none",
      },
    };
  }

  if (proposal?.outcome === "knowledge" && briefing.typeEvidence === "document") {
    return recommend(
      "keep_knowledge",
      label,
      "document",
      "The message reads as reusable guidance.",
      allowKnowledge
    );
  }

  if (proposal?.outcome === "task" && (proposal.task_fields?.title || proposal.summary)) {
    return recommend(
      "create_task",
      proposal.task_fields?.title || label,
      "document",
      "The message describes something to do.",
      allowKnowledge
    );
  }

  if (briefing.typeEvidence === "document" && briefing.contentType) {
    const understood = briefing.understanding;
    if (understood?.applicability === "other") {
      return {
        recommended_action: "ask",
        action_confidence: "ambiguous",
        reason: understood.summary,
        blocking_uncertainty: "property",
        clarifying_question: "This document appears to concern a different property. Keep it on this property file anyway?",
        clarifying_options: [
          { id: "yes", label: "Keep it on this property file anyway", action: "file_record" },
          { id: "else", label: "Something else", action: "something_else" },
        ],
        alternative_actions: withKnowledge(ISSUE_ACTIONS, allowKnowledge),
        understanding: { kind: "record", label: briefing.contentType, evidence: "document" },
      };
    }
    if (understood?.unresolved) {
      return {
        recommended_action: "ask",
        action_confidence: "ambiguous",
        reason: understood.summary,
        blocking_uncertainty: "contradiction",
        clarifying_question: "This document contradicts itself. File it without treating a status as fact?",
        clarifying_options: [
          { id: "yes", label: "Keep it on the property file", action: "file_record" },
          { id: "else", label: "Something else", action: "something_else" },
        ],
        alternative_actions: withKnowledge(ISSUE_ACTIONS, allowKnowledge),
        understanding: { kind: "record", label: briefing.contentType, evidence: "document" },
      };
    }
    return recommend("file_record", briefing.contentType, "document", "", allowKnowledge);
  }

  if (briefing.typeEvidence === "inference" && briefing.contentType) {
    return confirmType(
      briefing.contentType,
      "inference",
      `A short extract mentions ${friendlyType(briefing.contentType)}, which is not a full read.`,
      "file_record",
      allowKnowledge
    );
  }

  if (briefing.typeEvidence === "filename" && briefing.documentType && !isPhoto) {
    return confirmType(
      briefing.documentType,
      "filename",
      "Only the file name suggests this type.",
      "file_record",
      allowKnowledge
    );
  }

  return askWhatThisIs(
    allowKnowledge,
    isPhoto
      ? "The image has no readable document type."
      : "There isn't enough to tell what this is."
  );
}

export function intakeDecisionActionLabel(
  action: IntakeDecisionAction,
  documentType?: string | null
): string {
  const friendly = friendlyType(documentType || null);
  if (action === "file_record") {
    return friendly ? `Keep ${friendly} on property file` : "Keep on property file";
  }
  if (action === "create_task") return "Create task";
  return "Keep as Knowledge";
}
