/**
 * CreateTaskDialogs
 *
 * Renders all modal overlays triggered during task creation:
 *   - InviteUserModal (when "Invite to org" is tapped)
 *   - Checklist template save/edit/duplicate dialog
 *   - Template import conflict alert (replace vs append)
 *   - Archive template confirmation alert
 *
 * Pure presentational — all state is passed as props.
 * Extracted from CreateTaskModal.tsx (Tier 3 — gap-modal-size).
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InviteUserModal } from "@/components/invite/InviteUserModal";
import type { ChecklistTemplateCategory } from "@/hooks/useChecklistTemplates";
import type { PendingInvitation } from "./tabs/WhoTab";
import type { SubtaskInput } from "./SubtasksSection";
import { useToast } from "@/hooks/use-toast";

export type ChecklistTemplateDialogMode = "save" | "edit" | "duplicate";

export interface PendingTemplateImport {
  templateId: string;
  templateName: string;
  subtasks: SubtaskInput[];
}

const CHECKLIST_CATEGORY_OPTIONS: Array<{ value: ChecklistTemplateCategory; label: string }> = [
  { value: "compliance", label: "Compliance" },
  { value: "maintenance", label: "Maintenance" },
  { value: "security", label: "Security" },
  { value: "operations", label: "Operations" },
];

export interface CreateTaskDialogsProps {
  // Invite modal
  inviteModalOpen: boolean;
  setInviteModalOpen: (open: boolean) => void;
  invitePrefill: { firstName?: string; lastName?: string; email?: string } | null;
  setInvitePrefill: (p: { firstName?: string; lastName?: string; email?: string } | null) => void;
  setAssignedUserId: (id: string | undefined) => void;
  setPendingInvitations: React.Dispatch<React.SetStateAction<PendingInvitation[]>>;
  refreshMembers: () => void;
  // Template dialog
  templateDialogMode: ChecklistTemplateDialogMode | null;
  setTemplateDialogMode: (mode: ChecklistTemplateDialogMode | null) => void;
  templateDraftName: string;
  setTemplateDraftName: (name: string) => void;
  templateDraftCategory: ChecklistTemplateCategory;
  setTemplateDraftCategory: (cat: ChecklistTemplateCategory) => void;
  submitTemplateDialog: () => void;
  // Template import alert
  pendingTemplateImport: PendingTemplateImport | null;
  setPendingTemplateImport: (p: PendingTemplateImport | null) => void;
  setTemplateId: (id: string | null) => void;
  setSubtasks: React.Dispatch<React.SetStateAction<SubtaskInput[]>>;
  rememberRecentTemplate: (id: string) => void;
  // Archive alert
  showArchiveTemplateDialog: boolean;
  setShowArchiveTemplateDialog: (open: boolean) => void;
  activeTemplateName: string | null;
  confirmArchiveTemplate: () => void;
}

export function CreateTaskDialogs({
  inviteModalOpen,
  setInviteModalOpen,
  invitePrefill,
  setInvitePrefill,
  setAssignedUserId,
  setPendingInvitations,
  refreshMembers,
  templateDialogMode,
  setTemplateDialogMode,
  templateDraftName,
  setTemplateDraftName,
  templateDraftCategory,
  setTemplateDraftCategory,
  submitTemplateDialog,
  pendingTemplateImport,
  setPendingTemplateImport,
  setTemplateId,
  setSubtasks,
  rememberRecentTemplate,
  showArchiveTemplateDialog,
  setShowArchiveTemplateDialog,
  activeTemplateName,
  confirmArchiveTemplate,
}: CreateTaskDialogsProps) {
  const { toast } = useToast();
  const isTemplateDialogOpen = templateDialogMode !== null;
  const templateDialogTitle =
    templateDialogMode === "edit"
      ? "Edit Checklist Template"
      : templateDialogMode === "duplicate"
        ? "Duplicate Checklist Template"
        : "Save Checklist Template";
  const templateDialogCta = templateDialogMode === "edit" ? "Update Template" : "Save Template";

  return (
    <>
      {/* Invite user to org */}
      <InviteUserModal
        open={inviteModalOpen}
        onOpenChange={(open) => {
          setInviteModalOpen(open);
          if (!open) setInvitePrefill(null);
        }}
        prefillFirstName={invitePrefill?.firstName ?? ""}
        prefillLastName={invitePrefill?.lastName ?? ""}
        prefillEmail={invitePrefill?.email ?? ""}
        onInviteSent={(inv) => {
          if (inv.status === "accepted" && inv.userId) {
            setAssignedUserId(inv.userId);
            setPendingInvitations((prev) => prev.filter((p) => p.email !== inv.email));
            refreshMembers();
            return;
          }
          setPendingInvitations((prev) => [
            ...prev.filter((p) => p.email !== inv.email),
            {
              id: `pending-${inv.email}`,
              email: inv.email,
              firstName: inv.firstName,
              lastName: inv.lastName,
              displayName: `${inv.firstName} ${inv.lastName}`.trim(),
            },
          ]);
          setInvitePrefill(null);
        }}
      />

      {/* Save / Edit / Duplicate checklist template */}
      <Dialog
        open={isTemplateDialogOpen}
        onOpenChange={(open) => !open && setTemplateDialogMode(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{templateDialogTitle}</DialogTitle>
            <DialogDescription>
              Save checklist templates for quick reuse in task creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Template name</Label>
              <input
                value={templateDraftName}
                onChange={(e) => setTemplateDraftName(e.target.value)}
                placeholder="e.g. Fire Safety Check"
                className="w-full h-9 px-3 rounded-[10px] bg-input shadow-engraved text-sm text-foreground placeholder:text-muted-foreground/60 border-0 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category</Label>
              <Select
                value={templateDraftCategory}
                onValueChange={(v) => setTemplateDraftCategory(v as ChecklistTemplateCategory)}
              >
                <SelectTrigger className="h-9 shadow-engraved">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHECKLIST_CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setTemplateDialogMode(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={submitTemplateDialog}>
                {templateDialogCta}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template import: replace vs append */}
      <AlertDialog
        open={!!pendingTemplateImport}
        onOpenChange={(open) => !open && setPendingTemplateImport(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing checklist?</AlertDialogTitle>
            <AlertDialogDescription>
              You already have checklist items. Do you want to replace them with &ldquo;{pendingTemplateImport?.templateName}&rdquo;, or add the new items to the end?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setPendingTemplateImport(null)}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              className="shadow-e1"
              onClick={() => {
                if (!pendingTemplateImport) return;
                setTemplateId(pendingTemplateImport.templateId);
                setSubtasks((prev) => [...prev, ...pendingTemplateImport.subtasks]);
                if (pendingTemplateImport.templateId) {
                  rememberRecentTemplate(pendingTemplateImport.templateId);
                }
                const n = pendingTemplateImport.subtasks.length;
                toast({ title: "Checklist appended", description: `${n} item${n === 1 ? "" : "s"} added from "${pendingTemplateImport.templateName}".` });
                setPendingTemplateImport(null);
              }}
            >
              Append
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (!pendingTemplateImport) return;
                setTemplateId(pendingTemplateImport.templateId);
                setSubtasks(pendingTemplateImport.subtasks);
                if (pendingTemplateImport.templateId) {
                  rememberRecentTemplate(pendingTemplateImport.templateId);
                }
                const n = pendingTemplateImport.subtasks.length;
                toast({ title: "Checklist imported", description: `${n} item${n === 1 ? "" : "s"} loaded from "${pendingTemplateImport.templateName}".` });
                setPendingTemplateImport(null);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive template confirmation */}
      <AlertDialog open={showArchiveTemplateDialog} onOpenChange={setShowArchiveTemplateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive template?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{activeTemplateName}&rdquo; will be removed from the checklist picker. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmArchiveTemplate}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
