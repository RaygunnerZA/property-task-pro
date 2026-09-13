import { propertyActivityAssetsPath, propertyHubRecordsPath } from "@/lib/propertyRoutes";
import type { SuggestionAction, ActionableSuggestion } from "./actionableSuggestionTypes";
import type { WorkbenchAttentionSelectPayload } from "@/components/dashboard/SignalFeedDetailPanel";

export function performSuggestionAction(
  action: SuggestionAction,
  options?: { navigate?: (to: string) => void }
) {
  if (action.kind === "open_task" && action.taskId) {
    window.dispatchEvent(
      new CustomEvent("filla:assistant-open-task", { detail: { taskId: action.taskId } })
    );
    return;
  }

  if (action.kind === "open_record") {
    if (options?.navigate && action.propertyId) {
      options.navigate(propertyHubRecordsPath(action.propertyId, "expiring"));
      return;
    }
    window.dispatchEvent(
      new CustomEvent("filla:workbench-open-records", {
        detail: { documentId: action.recordId, propertyId: action.propertyId },
      })
    );
    return;
  }

  if (action.kind === "open_asset" && action.assetId) {
    const href = propertyActivityAssetsPath(action.propertyId, {
      assetId: action.assetId,
    });
    if (options?.navigate) {
      options.navigate(href);
      return;
    }
    window.dispatchEvent(
      new CustomEvent("filla:workbench-open-asset", {
        detail: { assetId: action.assetId, propertyId: action.propertyId, href },
      })
    );
    return;
  }

  if (action.kind === "open_signal" && action.signalId) {
    window.dispatchEvent(
      new CustomEvent("filla:workbench-open-signal", { detail: { signalId: action.signalId } })
    );
    return;
  }

  if (action.kind === "open_intake") {
    window.dispatchEvent(
      new CustomEvent("filla:workbench-open-intake", {
        detail: { mode: action.intakeMode ?? "add_record" },
      })
    );
  }
}

export function performSuggestionPrimaryAction(
  suggestion: ActionableSuggestion,
  options?: { navigate?: (to: string) => void }
) {
  if (suggestion.action.kind === "open_signal" && suggestion.action.signalId) {
    const payload: WorkbenchAttentionSelectPayload = {
      kind: "signal",
      snapshot: {
        id: `signal-${suggestion.action.signalId}`,
        signalId: suggestion.action.signalId,
        group: "review",
        title: suggestion.headline,
        context: suggestion.propertyName ?? "",
        description: suggestion.message,
        signalSubtype:
          suggestion.kind === "external_email" ? "ingestion.external_email" : undefined,
        fixtureActions:
          suggestion.kind === "external_email"
            ? {
                primary: { id: "signal-promote-intake", label: suggestion.action.label },
                secondary: [
                  { id: "signal-snooze", label: "Snooze" },
                  { id: "dismiss", label: "Dismiss" },
                ],
              }
            : {
                primary: { id: "signal-open", label: suggestion.action.label },
                secondary: [{ id: "dismiss", label: "Dismiss" }],
              },
      },
    };
    window.dispatchEvent(new CustomEvent("filla:workbench-open-attention", { detail: payload }));
    return;
  }

  performSuggestionAction(suggestion.action, options);
}
