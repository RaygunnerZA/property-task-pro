import { isSeededSampleContent } from "@/lib/onboardingEducation";
import type { SignalRow } from "./signalTypes";
import type {
  ActionableSuggestion,
  SuggestionAsset,
  SuggestionCompileContext,
  SuggestionDocument,
  SuggestionEvidence,
  SuggestionPerson,
  SuggestionTask,
} from "./actionableSuggestionTypes";
import {
  ACCESS_PATTERN,
  accessBlockerState,
  canManageSignals,
  daysAgo,
  daysUntil,
  documentDueIso,
  documentLabel,
  emailHasActionableTrigger,
  hasContradictoryLocations,
  hasTenantNotificationRecorded,
  isCancelledVisit,
  isCompletedTask,
  isFaultLike,
  isInspectionLike,
  isOpenTask,
  isVisitLike,
  looksLikeRenewalTask,
  sharedFaultTokens,
  sharedTokenCount,
  taskDueIso,
  taskHasCertificateAttachment,
  taskText,
  weekdayLabel,
} from "./suggestionMatching";

const EXPIRY_HORIZON_DAYS = 60;
const REPEAT_WINDOW_DAYS = 182;
const RECENT_REPORT_DAYS = 14;
const RECENT_COMPLETION_DAYS = 60;
const VISIT_HORIZON_DAYS = 7;

function fingerprint(suggestion: Pick<ActionableSuggestion, "kind" | "taskId" | "headline" | "propertyId">): string {
  return [suggestion.kind, suggestion.propertyId ?? "", suggestion.taskId ?? "", suggestion.headline].join("|");
}

function peopleForTask(
  task: SuggestionTask,
  ctx: SuggestionCompileContext
): SuggestionPerson[] {
  const people: SuggestionPerson[] = [];
  if (task.assigned_user_id) {
    const member = ctx.membersByUserId[task.assigned_user_id];
    people.push({
      id: task.assigned_user_id,
      name: member?.name ?? "Assigned person",
      role: member?.role ?? null,
    });
  }
  if (task.assigned_vendor_name) {
    people.push({
      id: `vendor:${task.id}`,
      name: task.assigned_vendor_name,
      role: "contractor",
    });
  }
  return people;
}

function assetIdsForTask(task: SuggestionTask, ctx: SuggestionCompileContext): string[] {
  const fromTask = Array.isArray(task.asset_ids) ? task.asset_ids.filter(Boolean) : [];
  const fromLinks = ctx.taskAssetLinks
    .filter((link) => link.taskId === task.id)
    .map((link) => link.assetId);
  return [...new Set([...fromTask, ...fromLinks])];
}

function assetForId(id: string | null | undefined, ctx: SuggestionCompileContext): SuggestionAsset | undefined {
  if (!id) return undefined;
  return ctx.assets.find((asset) => asset.id === id);
}

function isTutorialTask(task: SuggestionTask): boolean {
  return isSeededSampleContent({
    title: task.title,
    description: task.description,
  });
}

function isTutorialDocument(doc: SuggestionDocument): boolean {
  return isSeededSampleContent({
    title: doc.title,
    notes: doc.notes,
    description: doc.description,
  });
}

function isTutorialAsset(asset: SuggestionAsset | undefined): boolean {
  if (!asset) return false;
  return isSeededSampleContent({ name: asset.name });
}

function inScope(propertyId: string | null | undefined, ctx: SuggestionCompileContext): boolean {
  const restricted = (ctx.role ?? "").toLowerCase() === "staff" || (ctx.role ?? "").toLowerCase() === "member";
  if (restricted) {
    const allowed = ctx.assignedPropertyIds ?? [];
    if (!propertyId || !allowed.includes(propertyId)) return false;
  }
  if (ctx.scopedPropertyIds && ctx.scopedPropertyIds.size > 0) {
    if (propertyId && !ctx.scopedPropertyIds.has(propertyId)) return false;
  }
  return true;
}

function responsibilityBoost(userId: string | null | undefined, ctx: SuggestionCompileContext): number {
  if (userId && ctx.currentUserId && userId === ctx.currentUserId) return 18;
  if (!userId) return 4;
  return 0;
}

function isUserStateHidden(id: string, suggestion: ActionableSuggestion, ctx: SuggestionCompileContext): boolean {
  const state = ctx.userState[id];
  if (!state) return false;
  const current = fingerprint(suggestion);
  if (state.dismissedAt && state.fingerprint === current) return true;
  if (state.snoozedUntil && state.fingerprint === current) {
    return new Date(state.snoozedUntil).getTime() > ctx.now.getTime();
  }
  return false;
}

function keep(suggestion: ActionableSuggestion, ctx: SuggestionCompileContext): ActionableSuggestion | null {
  if (!inScope(suggestion.propertyId, ctx)) return null;
  if (!suggestion.action.label.trim()) return null;
  if (isUserStateHidden(suggestion.id, suggestion, ctx)) return null;
  return suggestion;
}

function evidenceTask(task: SuggestionTask): SuggestionEvidence {
  return {
    id: task.id,
    label: (task.title ?? "Open task").trim() || "Open task",
    kind: "task",
    action: { kind: "open_task", label: "Open task", taskId: task.id, propertyId: task.property_id },
  };
}

function evidenceRecord(doc: SuggestionDocument): SuggestionEvidence {
  return {
    id: doc.id,
    label: documentLabel(doc),
    kind: "record",
    action: {
      kind: "open_record",
      label: "Open record",
      recordId: doc.id,
      propertyId: doc.property_id,
    },
  };
}

function evidenceAsset(asset: SuggestionAsset): SuggestionEvidence {
  return {
    id: asset.id,
    label: asset.name,
    kind: "asset",
    action: {
      kind: "open_asset",
      label: "Open asset",
      assetId: asset.id,
      propertyId: asset.property_id,
    },
  };
}

function evidenceSignal(id: string, label: string, propertyId?: string | null): SuggestionEvidence {
  return {
    id,
    label,
    kind: "signal",
    action: { kind: "open_signal", label: "Open signal", signalId: id, propertyId },
  };
}

function certificateExpirySuggestions(ctx: SuggestionCompileContext): ActionableSuggestion[] {
  const out: ActionableSuggestion[] = [];
  for (const doc of ctx.documents) {
    if (!inScope(doc.property_id, ctx) || isTutorialDocument(doc)) continue;
    const due = documentDueIso(doc);
    const days = daysUntil(due, ctx.now);
    if (days == null || days > EXPIRY_HORIZON_DAYS || days < -90) continue;

    const renewalTasks = ctx.tasks.filter(
      (task) => !isTutorialTask(task) && looksLikeRenewalTask(task, doc)
    );
    if (renewalTasks.length > 0) continue;

    const label = documentLabel(doc);
    const expired = days < 0;
    const dayCount = Math.abs(days);
    const dayLabel = dayCount === 1 ? "1 day" : `${dayCount} days`;
    out.push({
      id: `certificate-expiry:${doc.id}`,
      kind: "certificate_expiry",
      headline: expired ? "This certificate has expired" : "Plan this certificate renewal",
      message: expired
        ? `${label} expired ${dayLabel} ago. No renewal task is linked.`
        : `${label} expires in ${dayLabel}. No renewal task is linked.`,
      action: {
        kind: "open_record",
        label: "Plan renewal",
        recordId: doc.id,
        propertyId: doc.property_id,
      },
      evidence: [evidenceRecord(doc)],
      propertyId: doc.property_id ?? null,
      propertyName: doc.property_name,
      assetId: doc.linked_asset_ids?.[0] ?? null,
      assetName: assetForId(doc.linked_asset_ids?.[0], ctx)?.name ?? null,
      taskId: null,
      people: [],
      signalIds: ctx.signals
        .filter((signal) => signal.property_id === doc.property_id && signal.subtype.startsWith("compliance."))
        .map((signal) => signal.id),
      confidence: "observed",
      priority: (expired ? 92 : 80) + Math.max(0, 20 - Math.abs(days)) + (!expired && days <= 14 ? 10 : 0),
    });
  }
  return out;
}

function waitingAccessSuggestions(ctx: SuggestionCompileContext): ActionableSuggestion[] {
  const out: ActionableSuggestion[] = [];
  for (const task of ctx.tasks) {
    if (!isOpenTask(task) || !inScope(task.property_id, ctx) || isTutorialTask(task)) continue;
    const messages = ctx.messagesByTaskId[task.id] ?? [];
    const blocker = accessBlockerState(task, messages);
    if (blocker !== "waiting") continue;
    const corpus = `${taskText(task)} ${messages.map((message) => message.body).join(" ")}`;
    if (!task.assigned_vendor_name && !/\b(contractor|engineer|plumber|electrician)\b/i.test(corpus)) {
      continue;
    }

    const observedWait = /\bwait(ing)?\b/i.test(corpus);
    out.push({
      id: `waiting-access:${task.id}`,
      kind: "waiting_access",
      headline: "Review access details",
      message: observedWait
        ? "The contractor is waiting for access details. Review them to move this repair forward."
        : "Access details for this repair are not confirmed in Filla. Review them before the visit.",
      action: {
        kind: "open_task",
        label: "Review access details",
        taskId: task.id,
        propertyId: task.property_id,
      },
      evidence: [
        evidenceTask(task),
        ...messages
          .filter((message) => ACCESS_PATTERN.test(message.body))
          .slice(0, 2)
          .map((message) => ({
            id: `${task.id}:${message.createdAt}`,
            label: "Task message mentioning access",
            kind: "message" as const,
            action: {
              kind: "open_task" as const,
              label: "Open task",
              taskId: task.id,
              propertyId: task.property_id,
            },
          })),
      ],
      propertyId: task.property_id ?? null,
      propertyName: task.property_name,
      taskId: task.id,
      people: peopleForTask(task, ctx),
      signalIds: [],
      confidence: observedWait ? "observed" : "qualified",
      priority: 88 + responsibilityBoost(task.assigned_user_id, ctx),
      responsibleUserId: task.assigned_user_id,
    });
  }
  return out;
}

function tasksShareIssue(a: SuggestionTask, b: SuggestionTask, ctx: SuggestionCompileContext): {
  matched: boolean;
  qualified: boolean;
} {
  if (a.id === b.id) return { matched: false, qualified: false };
  // Same property is required — do not match across properties or missing scope.
  if (!a.property_id || !b.property_id || a.property_id !== b.property_id) {
    return { matched: false, qualified: false };
  }
  const aAssets = new Set(assetIdsForTask(a, ctx));
  const bAssets = new Set(assetIdsForTask(b, ctx));
  if (aAssets.size > 0 && bAssets.size > 0) {
    const sharedAsset = [...aAssets].some((id) => bAssets.has(id));
    if (!sharedAsset) return { matched: false, qualified: false };
    return { matched: true, qualified: false };
  }
  if (hasContradictoryLocations(taskText(a), taskText(b))) {
    return { matched: false, qualified: false };
  }
  const overlap = sharedTokenCount(taskText(a), taskText(b));
  const bothFaults = isFaultLike(a) && isFaultLike(b);
  // Qualified matches need a shared specific fault noun plus enough overlapping context.
  if (bothFaults && overlap >= 2 && sharedFaultTokens(taskText(a), taskText(b))) {
    return { matched: true, qualified: true };
  }
  return { matched: false, qualified: false };
}

function duplicateCopy(qualified: boolean, leakLanguage: boolean): {
  headline: string;
  message: string;
  label: string;
} {
  if (qualified) {
    return {
      headline: "Check a possible duplicate",
      message:
        "This report describes a similar fault to an open repair at this property. Check whether they concern the same issue.",
      label: "Check possible duplicate",
    };
  }
  return {
    headline: "A matching repair is already open",
    message: leakLanguage
      ? "A task for this leak is already open. Link the new report so updates stay together."
      : "A task for this issue is already open. Link the new report so updates stay together.",
    label: "Review matching task",
  };
}

function duplicateReportSuggestions(ctx: SuggestionCompileContext): ActionableSuggestion[] {
  const out: ActionableSuggestion[] = [];
  const open = ctx.tasks.filter(
    (task) => isOpenTask(task) && inScope(task.property_id, ctx) && !isTutorialTask(task)
  );
  const recent = open.filter((task) => {
    const age = daysAgo(task.created_at, ctx.now);
    return age != null && age <= RECENT_REPORT_DAYS;
  });

  const used = new Set<string>();
  for (const incoming of recent) {
    const matches = open
      .filter((existing) => {
        if (existing.id === incoming.id) return false;
        const ageIncoming = daysAgo(incoming.created_at, ctx.now) ?? 0;
        const ageExisting = daysAgo(existing.created_at, ctx.now) ?? 0;
        return ageExisting > ageIncoming;
      })
      .map((existing) => ({ existing, match: tasksShareIssue(incoming, existing, ctx) }))
      .filter((row) => row.match.matched);

    if (matches.length === 0) continue;
    const best = matches.sort((a, b) => Number(a.match.qualified) - Number(b.match.qualified))[0]!;
    const pairKey = [incoming.id, best.existing.id].sort().join(":");
    if (used.has(pairKey)) continue;
    used.add(pairKey);

    const qualified = best.match.qualified;
    const leakLanguage = /\bleak/i.test(`${incoming.title ?? ""} ${best.existing.title ?? ""}`);
    const copy = duplicateCopy(qualified, leakLanguage);
    out.push({
      id: `duplicate-report:${pairKey}`,
      kind: "duplicate_report",
      headline: copy.headline,
      message: copy.message,
      action: {
        kind: "open_task",
        label: copy.label,
        taskId: best.existing.id,
        propertyId: best.existing.property_id,
      },
      evidence: [evidenceTask(incoming), evidenceTask(best.existing)],
      propertyId: incoming.property_id ?? best.existing.property_id ?? null,
      propertyName: incoming.property_name ?? best.existing.property_name,
      assetId: assetIdsForTask(best.existing, ctx)[0] ?? null,
      assetName: assetForId(assetIdsForTask(best.existing, ctx)[0], ctx)?.name ?? null,
      taskId: best.existing.id,
      people: peopleForTask(best.existing, ctx),
      signalIds: ctx.signals
        .filter((signal) => signal.converted_entity_id === incoming.id || signal.title === incoming.title)
        .map((signal) => signal.id),
      confidence: qualified ? "qualified" : "observed",
      priority: qualified ? 70 : 84,
      responsibleUserId: best.existing.assigned_user_id,
    });
  }

  for (const signal of ctx.signals) {
    if (!inScope(signal.property_id, ctx)) continue;
    if (signal.resolved_at) continue;
    const kind = signal.kind.toLowerCase();
    const isReport =
      kind === "upload" ||
      kind === "email" ||
      kind === "document" ||
      signal.subtype === "ingestion.external_email";
    if (!isReport) continue;
    if (!signal.property_id) continue;
    const probe: SuggestionTask = {
      id: `signal:${signal.id}`,
      title: signal.title,
      description: signal.body,
      status: "open",
      property_id: signal.property_id,
      created_at: signal.created_at,
      asset_ids: signal.asset_id ? [signal.asset_id] : [],
    };
    const match = open
      .map((task) => ({ task, match: tasksShareIssue(probe, task, ctx) }))
      .filter((row) => row.match.matched)[0];
    if (!match) continue;
    const qualified = match.match.qualified;
    const leakLanguage = /\bleak/i.test(`${signal.title} ${match.task.title ?? ""}`);
    const copy = duplicateCopy(qualified, leakLanguage);
    out.push({
      id: `duplicate-report:signal:${signal.id}:${match.task.id}`,
      kind: "duplicate_report",
      headline: copy.headline,
      message: copy.message,
      action: {
        kind: "open_task",
        label: copy.label,
        taskId: match.task.id,
        propertyId: match.task.property_id,
      },
      evidence: [
        evidenceSignal(signal.id, signal.title, signal.property_id),
        evidenceTask(match.task),
      ],
      propertyId: match.task.property_id ?? signal.property_id ?? null,
      propertyName: match.task.property_name,
      taskId: match.task.id,
      people: peopleForTask(match.task, ctx),
      signalIds: [signal.id],
      confidence: qualified ? "qualified" : "observed",
      priority: qualified ? 72 : 82,
      responsibleUserId: match.task.assigned_user_id,
    });
  }

  return out;
}

function matchingCertificateRecord(task: SuggestionTask, ctx: SuggestionCompileContext): SuggestionDocument | undefined {
  const completedAt = task.completed_at || task.updated_at;
  return ctx.documents.find((doc) => {
    if (isTutorialDocument(doc)) return false;
    if (doc.property_id && task.property_id && doc.property_id !== task.property_id) return false;
    const docText = `${doc.title ?? ""} ${doc.document_type ?? ""}`;
    if (sharedTokenCount(taskText(task), docText) < 1 && !isInspectionLike(task)) return false;
    if (!completedAt) return true;
    const created = doc.expiry_date || completedAt;
    const lag = Math.abs((new Date(created).getTime() - new Date(completedAt).getTime()) / (1000 * 60 * 60 * 24));
    return lag <= 90;
  });
}

function missingCertificateSuggestions(ctx: SuggestionCompileContext): ActionableSuggestion[] {
  const out: ActionableSuggestion[] = [];
  for (const task of ctx.tasks) {
    if (!isCompletedTask(task) || !inScope(task.property_id, ctx) || isTutorialTask(task)) continue;
    if (!isInspectionLike(task)) continue;
    const completedAge = daysAgo(task.completed_at || task.updated_at, ctx.now);
    if (completedAge == null || completedAge > RECENT_COMPLETION_DAYS) continue;
    if (taskHasCertificateAttachment(task)) continue;
    if (matchingCertificateRecord(task, ctx)) continue;

    out.push({
      id: `missing-certificate:${task.id}`,
      kind: "missing_certificate",
      headline: "The certificate is still missing",
      message: "The inspection task is complete, but its certificate hasn’t been attached.",
      action: {
        kind: "open_task",
        label: "Review inspection",
        taskId: task.id,
        propertyId: task.property_id,
      },
      evidence: [evidenceTask(task)],
      propertyId: task.property_id ?? null,
      propertyName: task.property_name,
      taskId: task.id,
      people: peopleForTask(task, ctx),
      signalIds: [],
      confidence: "observed",
      priority: 86 + responsibilityBoost(task.assigned_user_id, ctx),
      responsibleUserId: task.assigned_user_id,
    });
  }
  return out;
}

function repeatedFaultSuggestions(ctx: SuggestionCompileContext): ActionableSuggestion[] {
  const out: ActionableSuggestion[] = [];
  const groups = new Map<string, SuggestionTask[]>();
  for (const task of ctx.tasks) {
    if (!inScope(task.property_id, ctx) || isTutorialTask(task)) continue;
    if (!isFaultLike(task)) continue;
    const age = daysAgo(task.created_at, ctx.now);
    if (age == null || age > REPEAT_WINDOW_DAYS) continue;
    const assetIds = assetIdsForTask(task, ctx);
    if (assetIds.length === 0) continue;
    for (const assetId of assetIds) {
      const list = groups.get(assetId) ?? [];
      list.push(task);
      groups.set(assetId, list);
    }
  }

  for (const [assetId, tasks] of groups) {
    const unique = new Map<string, SuggestionTask>();
    for (const task of tasks) unique.set(task.id, task);
    const related = [...unique.values()];
    if (related.length < 3) continue;
    const asset = assetForId(assetId, ctx);
    if (isTutorialAsset(asset)) continue;
    const months = Math.max(1, Math.round(REPEAT_WINDOW_DAYS / 30));
    const latest = related.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0]!;
    const heating = related.some((task) => /\b(heat|boiler|radiator)\b/i.test(taskText(task)));
    const faultNoun = heating ? "heating fault" : "fault";
    out.push({
      id: `repeated-fault:${assetId}`,
      kind: "repeated_fault",
      headline: "Review the repair history first",
      message: `This is the ${ordinal(related.length)} ${faultNoun} reported in ${months} months. Review the repair history before booking another repair.`,
      action: {
        kind: "open_asset",
        label: "Review history",
        assetId,
        propertyId: latest.property_id ?? asset?.property_id,
      },
      evidence: [
        ...(asset ? [evidenceAsset(asset)] : []),
        ...related.slice(0, 3).map(evidenceTask),
      ],
      propertyId: latest.property_id ?? asset?.property_id ?? null,
      propertyName: latest.property_name,
      assetId,
      assetName: asset?.name ?? null,
      taskId: latest.id,
      people: peopleForTask(latest, ctx),
      signalIds: [],
      confidence: "observed",
      priority: 83 + Math.min(related.length, 6),
    });
  }
  return out;
}

function ordinal(value: number): string {
  const words = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
  if (value >= 1 && value < words.length) return words[value]!;
  const remainder = value % 10;
  const tens = value % 100;
  if (remainder === 1 && tens !== 11) return `${value}st`;
  if (remainder === 2 && tens !== 12) return `${value}nd`;
  if (remainder === 3 && tens !== 13) return `${value}rd`;
  return `${value}th`;
}

function tenantNotificationSuggestions(ctx: SuggestionCompileContext): ActionableSuggestion[] {
  const out: ActionableSuggestion[] = [];
  for (const task of ctx.tasks) {
    if (!isOpenTask(task) || !inScope(task.property_id, ctx) || isTutorialTask(task)) continue;
    if (!isVisitLike(task)) continue;
    const messages = ctx.messagesByTaskId[task.id] ?? [];
    if (isCancelledVisit(task, messages)) continue;
    const due = taskDueIso(task);
    const days = daysUntil(due, ctx.now);
    if (days == null || days < 0 || days > VISIT_HORIZON_DAYS) continue;
    if (hasTenantNotificationRecorded(task, messages)) continue;

    const when = due ? weekdayLabel(due, ctx.now) : "the booked day";
    out.push({
      id: `tenant-notify:${task.id}`,
      kind: "tenant_notification",
      headline: "Review the tenant update",
      message: `The visit is booked for ${when}. No tenant notification is recorded in Filla.`,
      action: {
        kind: "open_task",
        label: "Review tenant update",
        taskId: task.id,
        propertyId: task.property_id,
      },
      evidence: [evidenceTask(task)],
      propertyId: task.property_id ?? null,
      propertyName: task.property_name,
      taskId: task.id,
      people: peopleForTask(task, ctx),
      signalIds: [],
      confidence: "observed",
      priority: 76 + (days <= 1 ? 8 : 0) + responsibilityBoost(task.assigned_user_id, ctx),
      responsibleUserId: task.assigned_user_id,
    });
  }
  return out;
}

function offSiteSuggestions(ctx: SuggestionCompileContext): ActionableSuggestion[] {
  const out: ActionableSuggestion[] = [];
  for (const signal of ctx.signals) {
    if (signal.subtype !== "location.off_site_completion") continue;
    if (!inScope(signal.property_id, ctx)) continue;
    const taskId =
      typeof signal.payload?.task_id === "string"
        ? signal.payload.task_id
        : signal.converted_entity_id;
    const task = ctx.tasks.find((row) => row.id === taskId);
    out.push({
      id: `off-site:${signal.id}`,
      kind: "off_site_completion",
      headline: "Review this off-site completion",
      message: signal.body?.trim() || "Completion was recorded away from the property. Review the evidence before closing it out.",
      action: task
        ? { kind: "open_task", label: "Review completion", taskId: task.id, propertyId: task.property_id }
        : { kind: "open_signal", label: "Review completion", signalId: signal.id, propertyId: signal.property_id },
      evidence: [
        evidenceSignal(signal.id, signal.title, signal.property_id),
        ...(task ? [evidenceTask(task)] : []),
      ],
      propertyId: signal.property_id ?? task?.property_id ?? null,
      propertyName: task?.property_name,
      taskId: task?.id ?? null,
      people: task ? peopleForTask(task, ctx) : [],
      signalIds: [signal.id],
      confidence: "observed",
      priority: 74,
    });
  }
  return out;
}

function externalEmailSuggestions(ctx: SuggestionCompileContext): ActionableSuggestion[] {
  if (!canManageSignals(ctx.role)) return [];
  const out: ActionableSuggestion[] = [];
  for (const signal of ctx.signals) {
    if (signal.subtype !== "ingestion.external_email") continue;
    if (!inScope(signal.property_id, ctx)) continue;
    if (signal.resolved_at) continue;
    // Being external is not enough — only surface a specific request or decision.
    if (!emailHasActionableTrigger(signal)) continue;
    const from = String(signal.payload?.from ?? "").trim();
    const subject = String(signal.payload?.subject ?? signal.title).trim();
    out.push({
      id: `external-email:${signal.id}`,
      kind: "external_email",
      headline: "Review this inbound request",
      message: from
        ? `${from} sent a request that needs a decision in Filla${subject ? `: “${subject.slice(0, 80)}”` : ""}.`
        : `An external email needs a decision in Filla${subject ? `: “${subject.slice(0, 80)}”` : ""}.`,
      action: {
        kind: "open_signal",
        label: "Review request",
        signalId: signal.id,
        propertyId: signal.property_id,
      },
      evidence: [evidenceSignal(signal.id, signal.title, signal.property_id)],
      propertyId: signal.property_id ?? null,
      taskId: null,
      people: [],
      signalIds: [signal.id],
      confidence: "observed",
      priority: 68,
    });
  }
  return out;
}

function combineRelated(suggestions: ActionableSuggestion[]): ActionableSuggestion[] {
  const byIssue = new Map<string, ActionableSuggestion>();
  for (const suggestion of suggestions) {
    const issueKey =
      suggestion.kind === "repeated_fault" && suggestion.assetId
        ? `repeated-fault:${suggestion.assetId}`
        : suggestion.kind === "certificate_expiry" && suggestion.action.recordId
          ? `certificate-expiry:${suggestion.action.recordId}`
          : suggestion.kind === "duplicate_report" && suggestion.taskId
            ? `duplicate-report:${suggestion.taskId}`
            : suggestion.id;
    const existing = byIssue.get(issueKey);
    if (!existing || suggestion.priority > existing.priority) {
      if (existing) {
        suggestion.signalIds = [...new Set([...existing.signalIds, ...suggestion.signalIds])];
        suggestion.evidence = dedupeEvidence([...existing.evidence, ...suggestion.evidence]);
      }
      byIssue.set(issueKey, suggestion);
    } else {
      existing.signalIds = [...new Set([...existing.signalIds, ...suggestion.signalIds])];
      existing.evidence = dedupeEvidence([...existing.evidence, ...suggestion.evidence]);
    }
  }
  return [...byIssue.values()];
}

function dedupeEvidence(items: SuggestionEvidence[]): SuggestionEvidence[] {
  const seen = new Set<string>();
  const out: SuggestionEvidence[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function suggestionFingerprint(suggestion: ActionableSuggestion): string {
  return fingerprint(suggestion);
}

export function compileActionableSuggestions(ctx: SuggestionCompileContext): ActionableSuggestion[] {
  const compiled = [
    ...certificateExpirySuggestions(ctx),
    ...waitingAccessSuggestions(ctx),
    ...duplicateReportSuggestions(ctx),
    ...missingCertificateSuggestions(ctx),
    ...repeatedFaultSuggestions(ctx),
    ...tenantNotificationSuggestions(ctx),
    ...offSiteSuggestions(ctx),
    ...externalEmailSuggestions(ctx),
  ]
    .map((suggestion) => keep(suggestion, ctx))
    .filter((suggestion): suggestion is ActionableSuggestion => Boolean(suggestion));

  return combineRelated(compiled).sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aMine = a.responsibleUserId && a.responsibleUserId === ctx.currentUserId ? 1 : 0;
    const bMine = b.responsibleUserId && b.responsibleUserId === ctx.currentUserId ? 1 : 0;
    return bMine - aMine;
  });
}

export function toSuggestionTasks(rows: Array<Record<string, unknown>>): SuggestionTask[] {
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    title: (row.title as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    priority: (row.priority as string | null) ?? null,
    property_id: (row.property_id as string | null) ?? null,
    property_name: (row.property_name as string | null) ?? null,
    assigned_user_id: (row.assigned_user_id as string | null) ?? null,
    assigned_vendor_name: (row.assigned_vendor_name as string | null) ?? null,
    due_date: (row.due_date as string | null) ?? (row.due_at as string | null) ?? null,
    due_at: (row.due_at as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    is_compliance: (row.is_compliance as boolean | null) ?? null,
    type: (row.type as string | null) ?? null,
    images: row.images,
    asset_ids: Array.isArray(row.asset_ids) ? (row.asset_ids as string[]) : null,
  })).filter((task) => task.id);
}

export function toSuggestionDocuments(rows: Array<Record<string, unknown>>): SuggestionDocument[] {
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    title: (row.title as string | null) ?? null,
    document_type: (row.document_type as string | null) ?? null,
    expiry_date: (row.expiry_date as string | null) ?? null,
    next_due_date: (row.next_due_date as string | null) ?? null,
    property_id: (row.property_id as string | null) ?? null,
    property_name: (row.property_name as string | null) ?? null,
    linked_asset_ids: Array.isArray(row.linked_asset_ids) ? (row.linked_asset_ids as string[]) : null,
    expiry_state: (row.expiry_state as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    description: (row.description as string | null) ?? null,
  })).filter((doc) => doc.id);
}

export function signalsForCompiler(rows: SignalRow[]): SuggestionCompileContext["signals"] {
  return rows.map((row) => ({
    id: row.id,
    property_id: row.property_id,
    asset_id: row.asset_id,
    space_id: row.space_id,
    kind: row.kind,
    subtype: row.subtype,
    severity: row.severity,
    title: row.title,
    body: row.body,
    disposition: row.disposition,
    payload: row.payload,
    recommendation: row.recommendation,
    created_at: row.created_at,
    expires_at: row.expires_at,
    resolved_at: row.resolved_at,
    converted_entity_type: row.converted_entity_type,
    converted_entity_id: row.converted_entity_id,
  }));
}
