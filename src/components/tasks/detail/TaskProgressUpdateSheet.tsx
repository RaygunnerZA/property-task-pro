import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, CheckSquare, FileText, Loader2, MapPin, Plus, Send, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useDataContext } from "@/contexts/DataContext";
import { useToast } from "@/hooks/use-toast";
import { useGeoCaptureOnAction } from "@/hooks/useGeoCaptureOnAction";
import { supabase } from "@/integrations/supabase/client";
import { toErrorMessage } from "@/lib/error";
import { markTaskCommentSeen } from "@/lib/taskCommentSeen";
import { cn } from "@/lib/utils";
import { clipboardImageFiles } from "@/utils/ingestIntakeMediaFiles";

type AttachmentPreview = {
  id: string;
  file: File;
  preview?: string;
};

type TaskProgressUpdateSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  propertyId?: string | null;
  /** Jump to checklist in the detail scroll. */
  onOpenChecklist?: () => void;
};

/**
 * Lightweight composer for an on-task progress entry (note / photo / file / location).
 * Posts into the task conversation so Activity and Messaging both reflect it.
 */
export function TaskProgressUpdateSheet({
  open,
  onOpenChange,
  taskId,
  propertyId,
  onOpenChecklist,
}: TaskProgressUpdateSheetProps) {
  const { orgId } = useActiveOrg();
  const { userId } = useDataContext();
  const { toast } = useToast();
  const { capture: captureGeo } = useGeoCaptureOnAction();
  const queryClient = useQueryClient();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [includeLocation, setIncludeLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(note.trim() || attachments.length > 0 || includeLocation),
    [note, attachments.length, includeLocation]
  );

  const reset = () => {
    setNote("");
    setAttachments([]);
    setIncludeLocation(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const addFiles = (files: FileList | File[] | null, imagesOnly: boolean) => {
    if (!files) return;
    const list = Array.isArray(files) ? files : Array.from(files);
    if (list.length === 0) return;
    list.forEach((file) => {
      if (imagesOnly && !file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      const id = crypto.randomUUID();
      const item: AttachmentPreview = { id, file };
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          item.preview = e.target?.result as string;
          setAttachments((prev) => [...prev, item]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachments((prev) => [...prev, item]);
      }
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const images = clipboardImageFiles(e.clipboardData);
    if (images.length === 0) return;
    e.preventDefault();
    addFiles(images, true);
  };

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    if (!orgId || !userId) {
      toast({
        title: "Can't post update",
        description: "Sign in and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("id")
        .eq("org_id", orgId)
        .eq("task_id", taskId)
        .maybeSingle();

      if (convError && convError.code !== "PGRST116") throw convError;

      let conversationId: string;
      if (!conversation) {
        const { data: newConv, error: createError } = await supabase
          .from("conversations")
          .insert({
            org_id: orgId,
            task_id: taskId,
            channel: "task",
            subject: `Task ${taskId}`,
          } as any)
          .select("id")
          .single();
        if (createError) throw createError;
        conversationId = newConv.id;
      } else {
        conversationId = conversation.id;
      }

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const authorName = authUser?.email?.split("@")[0] || "User";

      const bodyParts: string[] = [];
      if (note.trim()) bodyParts.push(note.trim());
      if (attachments.length > 0 && !note.trim()) {
        bodyParts.push(
          `Progress update · ${attachments.length} file${attachments.length > 1 ? "s" : ""}`
        );
      }
      if (includeLocation && bodyParts.length === 0) {
        bodyParts.push("Progress update · location recorded");
      }
      const body = bodyParts.join("\n") || "Progress update";

      const { data: message, error: insertError } = await supabase
        .from("messages")
        .insert({
          org_id: orgId,
          conversation_id: conversationId,
          author_user_id: userId,
          author_name: authorName,
          body,
          source: "web",
          direction: "outbound",
        } as any)
        .select("id")
        .single();

      if (insertError) throw insertError;

      for (const attachment of attachments) {
        try {
          const fileExt = attachment.file.name.split(".").pop();
          const fileName = `org/${orgId}/messages/${message.id}/${crypto.randomUUID()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from("task-images")
            .upload(fileName, attachment.file, { cacheControl: "3600", upsert: false });
          if (uploadError) continue;
          const { data: urlData } = supabase.storage.from("task-images").getPublicUrl(fileName);
          await supabase.from("attachments").insert({
            org_id: orgId,
            file_url: urlData.publicUrl,
            file_name: attachment.file.name,
            file_type: attachment.file.type,
            file_size: attachment.file.size,
            parent_type: "message",
            parent_id: message.id,
          } as any);
        } catch {
          /* continue other files */
        }
      }

      if (includeLocation) {
        captureGeo("site_visit", { taskId, propertyId });
      }

      // Prefer DB RPC when present; ignore if types/client lag migrations.
      try {
        await (supabase as any).rpc("record_task_audit", {
          p_org_id: orgId,
          p_task_id: taskId,
          p_action: "task.progress_update",
          p_metadata: {
            summary: note.trim()
              ? `Progress update · ${note.trim().slice(0, 72)}`
              : "Progress update posted",
            message_id: message.id,
            has_attachments: attachments.length > 0,
            has_location: includeLocation,
          },
        });
      } catch {
        /* trigger/message path still records the update */
      }

      markTaskCommentSeen(taskId);
      void queryClient.invalidateQueries({ queryKey: ["task-messages", orgId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ["task-comment-count", taskId] });
      void queryClient.invalidateQueries({ queryKey: ["task-comment-signals", orgId] });
      void queryClient.invalidateQueries({ queryKey: ["task-audit-log", orgId, taskId] });

      toast({ title: "Progress update added" });
      handleOpenChange(false);
    } catch (err: unknown) {
      toast({
        title: "Couldn't add update",
        description: toErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="gap-4 sm:max-w-lg sm:mx-auto">
        <SheetHeader className="text-left pr-8">
          <SheetTitle>Add progress update</SheetTitle>
          <SheetDescription>
            Note what changed — optionally attach a photo, file, or location.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onPaste={handlePaste}
            placeholder="What’s the latest on this task?"
            className="min-h-[6rem] resize-none bg-input shadow-engraved"
            disabled={isSubmitting}
          />

          {attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <div key={a.id} className="relative overflow-hidden rounded-card shadow-e1">
                  {a.preview ? (
                    <div className="relative h-14 w-14">
                      <img src={a.preview} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5"
                        onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex max-w-[140px] items-center gap-1.5 bg-muted/40 px-2 py-1.5">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate text-2xs">{a.file.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files, true);
                e.target.value = "";
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files, false);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shadow-e1"
              onClick={() => imageInputRef.current?.click()}
              disabled={isSubmitting}
            >
              <Camera className="h-4 w-4" />
              Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shadow-e1"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
            >
              <FileText className="h-4 w-4" />
              File
            </Button>
            <Button
              type="button"
              variant={includeLocation ? "default" : "outline"}
              size="sm"
              className={cn(!includeLocation && "shadow-e1")}
              onClick={() => setIncludeLocation((v) => !v)}
              disabled={isSubmitting}
            >
              <MapPin className="h-4 w-4" />
              Location
            </Button>
            {onOpenChecklist ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shadow-e1"
                onClick={() => {
                  handleOpenChange(false);
                  requestAnimationFrame(() => onOpenChecklist());
                }}
                disabled={isSubmitting}
              >
                <CheckSquare className="h-4 w-4" />
                Checklist
              </Button>
            ) : null}
          </div>
        </div>

        <SheetFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || isSubmitting}
            className="shadow-primary-btn"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                Post update
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
