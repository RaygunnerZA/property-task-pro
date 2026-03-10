import { useRef, useState, useEffect, useLayoutEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Check,
  ToggleLeft,
  AlignLeft,
  Hash,
  Camera,
  Upload,
  PenLine,
  ScanLine,
  ShieldCheck,
  Heading,
  Info,
  Indent,
  Outdent,
  Minus,
  User,
  GitBranch,
  X,
  type LucideIcon,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubtaskOptionsMenu } from "./SubtaskOptionsMenu";
import { cn } from "@/lib/utils";
import type { OrgMember } from "@/hooks/useOrgMembers";

// ─── Step Type System ─────────────────────────────────────────────────────────

export type StepType =
  | "check"
  | "yes_no"
  | "text"
  | "number"
  | "photo"
  | "file"
  | "signature"
  | "scan"
  | "pass_fail"
  | "title"
  | "note"
  | "sub_step"
  | "divider";

export interface StepTypeConfig {
  icon: LucideIcon;
  label: string;
}

export const STEP_TYPE_CONFIG: Record<StepType, StepTypeConfig> = {
  check:     { icon: Check,       label: "Check"      },
  yes_no:    { icon: ToggleLeft,  label: "Yes / No"   },
  text:      { icon: AlignLeft,   label: "Text"       },
  number:    { icon: Hash,        label: "Number"     },
  photo:     { icon: Camera,      label: "Photo"      },
  file:      { icon: Upload,      label: "File"       },
  signature: { icon: PenLine,     label: "Signature"  },
  scan:      { icon: ScanLine,    label: "Scan"       },
  pass_fail: { icon: ShieldCheck, label: "Pass / Fail"},
  title:     { icon: Heading,     label: "Title"      },
  note:      { icon: Info,        label: "Note"       },
  sub_step:  { icon: Indent,      label: "Sub-step"   },
  divider:   { icon: Minus,       label: "Divider"    },
};

/** @deprecated — use RESPONSE_TYPES / FORMAT_TYPES internally. Kept for external compatibility. */
export const STEP_TYPES_ORDERED: StepType[] = [
  "check", "yes_no", "text", "number", "photo", "file", "signature", "scan", "pass_fail",
];

const RESPONSE_TYPES: StepType[] = [
  "check", "yes_no", "text", "number", "photo", "file", "signature", "scan", "pass_fail",
];

const FORMAT_TYPES: StepType[] = ["title", "note", "sub_step", "divider"];

// ─── SubtaskData ──────────────────────────────────────────────────────────────

export interface StepNote {
  text: string;
  created_at: string;
  created_by_name?: string;
  created_by_avatar?: string;
}

export interface SubtaskData {
  id: string;
  title: string;
  /** @deprecated Use step_type. Kept for DB / RPC compatibility. */
  is_yes_no: boolean;
  /** @deprecated Use step_type. Kept for DB / RPC compatibility. */
  requires_signature: boolean;
  /** UI-layer step type. Supersedes is_yes_no / requires_signature. */
  step_type?: StepType;
  /** When true, a red asterisk is shown and completion is mandatory. */
  is_required?: boolean;
  /** When true, shows a follow-up branch indicator for failed checks. */
  has_followup_if_failed?: boolean;
  /** Org user ID pre-assigned to complete this step. */
  assigned_user_id?: string;
  /** Display name of the assigned user (denormalised for quick render). */
  assigned_user_name?: string;
  /** Inline annotation note attached to this step. */
  note?: StepNote;
  /** Follow-up step shown when this step is marked failed. */
  followup?: { title: string; step_type?: StepType };
}

/** Resolve the effective step type from a SubtaskData record. */
export function getStepType(step: SubtaskData): StepType {
  if (step.step_type) return step.step_type;
  if (step.is_yes_no) return "yes_no";
  if (step.requires_signature) return "signature";
  return "check";
}

/** Sync the legacy boolean fields from a step type (for DB compat). */
export function stepTypeToLegacy(
  type: StepType
): Pick<SubtaskData, "is_yes_no" | "requires_signature"> {
  return {
    is_yes_no: type === "yes_no",
    requires_signature: type === "signature",
  };
}

// ─── Keyword Detection ────────────────────────────────────────────────────────

const KEYWORD_PATTERNS: Array<{ pattern: RegExp; type: StepType }> = [
  { pattern: /\b(photo|photograph|picture|img|image)\b/i,                    type: "photo"     },
  { pattern: /\b(scan|qr|barcode)\b/i,                                       type: "scan"      },
  { pattern: /\b(sign|signature)\b/i,                                        type: "signature" },
  { pattern: /\b(temperature|pressure|meter|reading|measure|weight|height|count)\b/i, type: "number" },
  { pattern: /\b(file|document|attach|upload|pdf)\b/i,                       type: "file"      },
  { pattern: /\b(pass|fail)\b/i,                                             type: "pass_fail" },
];

function detectStepType(title: string): StepType | null {
  for (const { pattern, type } of KEYWORD_PATTERNS) {
    if (pattern.test(title)) return type;
  }
  return null;
}

function formatNoteDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    + " · "
    + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const NOTE_AVATAR_COLORS = [
  "#8EC9CE", "#7B6FD6", "#F59E0B", "#10B981",
  "#EC4899", "#F97316", "#06B6D4", "#84CC16",
];

function stringToColor(str?: string): string {
  if (!str) return "#8EC9CE";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return NOTE_AVATAR_COLORS[Math.abs(hash) % NOTE_AVATAR_COLORS.length];
}

// ─── Component ───────────────────────────────────────────────────────────────

interface SubtaskCardProps {
  subtask: SubtaskData;
  index: number;
  isCreator?: boolean;
  autoFocus?: boolean;
  members?: OrgMember[];
  onUpdate: (id: string, updates: Partial<SubtaskData>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onEnterPress: (id: string) => void;
  onBackspaceDelete: (id: string) => void;
  onFocusPrevious: (id: string) => void;
  onFocusNext: (id: string) => void;
}

export function SubtaskCard({
  subtask,
  index: _index,
  isCreator = true,
  autoFocus = false,
  members = [],
  onUpdate,
  onDelete,
  onDuplicate,
  onEnterPress,
  onBackspaceDelete,
  onFocusPrevious,
  onFocusNext,
}: SubtaskCardProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [asteriskLeft, setAsteriskLeft] = useState(0);
  const [uploadedPhotoName, setUploadedPhotoName] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [backspaceCount, setBackspaceCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const currentType = getStepType(subtask);
  const { icon: StepIcon } = STEP_TYPE_CONFIG[currentType];
  const isFormatType = FORMAT_TYPES.includes(currentType);
  const isSubStep = currentType === "sub_step";

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (subtask.title.length > 0) setBackspaceCount(0);
  }, [subtask.title]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 64)}px`;
    }
  }, [subtask.title]);

  // Measure text width to position required asterisk right after the last character
  useLayoutEffect(() => {
    if (!subtask.is_required) return;
    if (mirrorRef.current && inputRef.current) {
      const mirrorWidth = mirrorRef.current.offsetWidth;
      const maxLeft = inputRef.current.clientWidth - 10;
      setAsteriskLeft(Math.min(mirrorWidth + 2, maxLeft));
    }
  }, [subtask.title, subtask.is_required, currentType]);

  // Auto-resize note textarea
  useEffect(() => {
    if (noteRef.current) {
      noteRef.current.style.height = "auto";
      noteRef.current.style.height = `${Math.min(noteRef.current.scrollHeight, 96)}px`;
    }
  }, [subtask.note?.text]);

  // Focus note when it's first added
  useEffect(() => {
    if (subtask.note && !subtask.note.text && noteRef.current) {
      noteRef.current.focus();
    }
  }, [subtask.note]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      setIsFocused(false);
      onEnterPress(subtask.id);
    } else if (e.key === "Backspace" && subtask.title === "") {
      e.preventDefault();
      if (backspaceCount >= 1) {
        setIsDeleting(true);
        setTimeout(() => onBackspaceDelete(subtask.id), 120);
      } else {
        setBackspaceCount(1);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      onFocusPrevious(subtask.id);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onFocusNext(subtask.id);
    }
  };

  const handleTitleChange = (value: string) => {
    const updates: Partial<SubtaskData> = { title: value };

    // Auto-suggest type from keywords only when still on the default check type
    if (currentType === "check") {
      const detected = detectStepType(value);
      if (detected) {
        updates.step_type = detected;
        updates.is_yes_no = detected === "yes_no";
        updates.requires_signature = detected === "signature";
      }
    }

    onUpdate(subtask.id, updates);
  };

  const handleTypeSelect = (type: StepType) => {
    onUpdate(subtask.id, {
      step_type: type,
      ...stepTypeToLegacy(type),
    });
  };

  const handleDelete = () => {
    setIsDeleting(true);
    setTimeout(() => onDelete(subtask.id), 120);
  };

  // ─── Options menu callbacks ────────────────────────────────────────────────

  const handleToggleRequired = () => {
    onUpdate(subtask.id, { is_required: !subtask.is_required });
  };

  const handleAddNote = () => {
    if (subtask.note) {
      // Remove note
      onUpdate(subtask.id, { note: undefined });
    } else {
      // Add note with current timestamp
      onUpdate(subtask.id, {
        note: {
          text: "",
          created_at: new Date().toISOString(),
        },
      });
    }
  };

  const handleToggleFollowup = () => {
    const enabling = !subtask.has_followup_if_failed;
    onUpdate(subtask.id, {
      has_followup_if_failed: enabling,
      // Seed an empty followup when enabling; clear it when disabling
      followup: enabling ? (subtask.followup ?? { title: "", step_type: "check" }) : undefined,
    });
  };

  const handleAssignUser = (member: OrgMember) => {
    onUpdate(subtask.id, {
      assigned_user_id: member.user_id,
      assigned_user_name: member.display_name,
    });
    setAssignPickerOpen(false);
  };

  const handleUnassignUser = () => {
    onUpdate(subtask.id, {
      assigned_user_id: undefined,
      assigned_user_name: undefined,
    });
  };

  const filteredMembers = members.filter((m) =>
    m.display_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    (m.email ?? "").toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-all duration-150",
        isDragging && "opacity-50 z-50",
        isDeleting && "opacity-0 scale-95"
      )}
    >
      <div
        ref={cardRef}
        className={cn(
          "rounded-xl bg-transparent transition-shadow",
          isDragging && "shadow-e2",
          isSubStep && "ml-5"
        )}
        style={{ boxShadow: "none", border: "none" }}
      >
        {/* Main Row */}
        <div
          className="group/row flex items-center gap-[3px] pl-0 pr-0 py-0 rounded"
          style={{ backgroundColor: "rgba(255, 255, 255, 0)", height: "42px" }}
        >
          {/* Drag Handle */}
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
            <GripVertical className="h-4 w-4 text-muted-foreground/40" />
          </div>

          {/* Circle checkbox — marks step complete (decorative in creator mode) */}
          {currentType !== "divider" && (
            <div className="shrink-0 h-[14px] w-[14px] rounded-full bg-card shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08),inset_-1px_-1px_2px_rgba(255,255,255,0.6)] flex items-center justify-center">
              {!isCreator && (
                <Check className="h-2.5 w-2.5 text-accent opacity-0 group-hover/row:opacity-30 transition-opacity" />
              )}
            </div>
          )}

          {/* Divider step — render a horizontal rule instead of input */}
          {currentType === "divider" && (
            <div className="flex-1 flex items-center px-1">
              <div className="flex-1 border-t border-dashed border-muted-foreground/25" />
            </div>
          )}

          {/* Step Title Input + required asterisk measured after text */}
          {currentType !== "divider" && (
            <div className="relative flex-1 min-w-0" style={{ boxSizing: "content-box" }}>
              {/* Hidden mirror span — measures rendered text width for asterisk placement */}
              {subtask.is_required && (
                <span
                  ref={mirrorRef}
                  aria-hidden="true"
                  className="absolute invisible whitespace-pre pointer-events-none top-0 left-0"
                  style={{
                    fontSize: currentType === "title" ? "18px" : "14px",
                    fontWeight: currentType === "title" ? "600" : "400",
                    fontFamily: "inherit",
                    letterSpacing: "inherit",
                  }}
                >
                  {subtask.title}
                </span>
              )}

              <Textarea
                ref={inputRef}
                placeholder={
                  currentType === "title"  ? "Section heading…"
                  : currentType === "note" ? "Add a note…"
                  : "Add step…"
                }
                value={subtask.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className={cn(
                  "w-full min-h-[32px] max-h-[64px] border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 resize-none overflow-y-auto",
                  currentType === "title" ? "text-[18px] md:text-[18px] font-semibold" : "text-[14px] md:text-[14px]",
                  currentType === "note" && "italic"
                )}
                style={{
                  border: "none",
                  outline: "none",
                  color: currentType === "note"
                    ? "rgba(42, 41, 62, 0.5)"
                    : "rgba(42, 41, 62, 1)",
                  paddingTop: "6px",
                  paddingBottom: "6px",
                  paddingLeft: "6px",
                }}
                rows={1}
              />

              {subtask.is_required && (
                <span
                  className="absolute top-[7px] text-[#EB6834] font-bold text-sm leading-none pointer-events-none select-none"
                  style={{ left: `${asteriskLeft}px` }}
                  aria-hidden="true"
                >
                  *
                </span>
              )}
            </div>
          )}

          {/* Follow-up if failed indicator */}
          {subtask.has_followup_if_failed && (
            <GitBranch className="h-3 w-3 shrink-0 text-amber-400/80" />
          )}

          {/* Assigned user badge */}
          {subtask.assigned_user_id && (
            <div
              className="shrink-0 h-5 w-5 rounded-full bg-accent/20 flex items-center justify-center cursor-pointer"
              title={subtask.assigned_user_name ?? "Assigned user"}
              onClick={handleUnassignUser}
            >
              <User className="h-3 w-3 text-accent" />
            </div>
          )}

          {/* Options Menu */}
          <SubtaskOptionsMenu
            isCreator={isCreator}
            isRequired={subtask.is_required}
            hasNote={!!subtask.note}
            hasFollowupIfFailed={subtask.has_followup_if_failed}
            assignedUserName={subtask.assigned_user_name}
            onToggleRequired={handleToggleRequired}
            onAddNote={handleAddNote}
            onToggleFollowupIfFailed={handleToggleFollowup}
            onOpenAssignPicker={() => setAssignPickerOpen(true)}
            onDuplicate={() => onDuplicate(subtask.id)}
            onDelete={handleDelete}
          />

          {/* ── Right-side step-type affordances ─────────────────── */}
          {!isFormatType && (
            <>
              {currentType === "yes_no" && (
                <div className="shrink-0 flex items-center rounded-lg bg-[#8EC9CE] shadow-[inset_1px_6.5px_7.2px_0px_rgba(0,0,0,0.25),inset_-1px_-3.9px_3.5px_0px_rgba(255,255,255,0.53),inset_0px_-1.1px_0.6px_0px_rgba(255,255,255,1)] px-0.5 pt-0.5 pb-[3px] w-[68px] border-none">
                  <span className="h-6 px-[9px] rounded-md flex items-center text-[10px] font-medium text-muted-foreground/50 bg-card shadow-[1px_1px_2px_rgba(0,0,0,0.1),-1px_-1px_2px_rgba(255,255,255,0.8)]">
                    No
                  </span>
                  <span className="h-6 px-[6px] rounded-md flex items-center text-[10px] font-medium text-white/75">
                    Yes
                  </span>
                </div>
              )}

              {currentType === "number" && (
                <div className="shrink-0 w-10 h-6 rounded-lg bg-card flex items-center justify-center shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08),inset_-1px_-1px_2px_rgba(255,255,255,0.5)] text-[11px] text-muted-foreground font-medium">
                  0
                </div>
              )}

              {currentType === "pass_fail" && (
                <div className="shrink-0 flex items-center gap-1">
                  <div className="h-6 px-2 rounded-lg bg-card flex items-center text-[10px] font-medium uppercase tracking-wide text-emerald-500 shadow-[1px_1px_2px_rgba(0,0,0,0.1),-1px_-1px_2px_rgba(255,255,255,0.7)]">Pass</div>
                  <div className="h-6 px-2 rounded-lg bg-card flex items-center text-[10px] font-medium uppercase tracking-wide text-destructive/50 shadow-[1px_1px_2px_rgba(0,0,0,0.1),-1px_-1px_2px_rgba(255,255,255,0.7)]">Fail</div>
                </div>
              )}

              {currentType === "photo" && (
                <>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setUploadedPhotoName(f ? f.name : null);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className={cn(
                      "shrink-0 h-6 px-2 rounded-[8px] bg-card flex items-center gap-[5px] transition-all cursor-pointer",
                      uploadedPhotoName
                        ? "shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08),inset_-1px_-1px_2px_rgba(255,255,255,0.5)]"
                        : "shadow-[1px_1px_2px_rgba(0,0,0,0.1),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08),inset_-1px_-1px_2px_rgba(255,255,255,0.5)]"
                    )}
                    title={uploadedPhotoName ?? "Upload photo"}
                  >
                    <Camera className={cn("h-3.5 w-3.5", uploadedPhotoName ? "text-accent" : "text-muted-foreground/60")} />
                    <span className={cn("text-[10px] font-mono font-medium uppercase tracking-wide max-w-[60px] truncate", uploadedPhotoName ? "text-accent" : "text-muted-foreground/50")}>
                      {uploadedPhotoName ? uploadedPhotoName.split(".")[0] : "Upload"}
                    </span>
                  </button>
                </>
              )}

              {currentType === "file" && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setUploadedFileName(f ? f.name : null);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "shrink-0 h-6 px-2 rounded-[8px] bg-card flex items-center gap-[5px] transition-all cursor-pointer",
                      uploadedFileName
                        ? "shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08),inset_-1px_-1px_2px_rgba(255,255,255,0.5)]"
                        : "shadow-[1px_1px_2px_rgba(0,0,0,0.1),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08),inset_-1px_-1px_2px_rgba(255,255,255,0.5)]"
                    )}
                    title={uploadedFileName ?? "Upload file"}
                  >
                    <Upload className={cn("h-3.5 w-3.5", uploadedFileName ? "text-accent" : "text-muted-foreground/60")} />
                    <span className={cn("text-[10px] font-mono font-medium uppercase tracking-wide max-w-[60px] truncate", uploadedFileName ? "text-accent" : "text-muted-foreground/50")}>
                      {uploadedFileName ? uploadedFileName.split(".")[0] : "Upload"}
                    </span>
                  </button>
                </>
              )}

              {currentType === "signature" && (
                <div className="shrink-0 h-6 px-2 rounded-[8px] bg-card flex items-center gap-1 shadow-[1px_1px_2px_rgba(0,0,0,0.1),-1px_-1px_2px_rgba(255,255,255,0.7)]">
                  <PenLine className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="text-[10px] font-mono font-medium text-muted-foreground/50 uppercase tracking-wide">Sign</span>
                </div>
              )}

              {currentType === "scan" && (
                <div className="shrink-0 h-6 px-2 rounded-[8px] bg-card flex items-center gap-[6px] shadow-[1px_1px_2px_rgba(0,0,0,0.1),-1px_-1px_2px_rgba(255,255,255,0.7)]">
                  <ScanLine className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide">Scan</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Inline type selector — expands when step is focused ──── */}
        {currentType !== "divider" && (
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              isFocused ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}
          >
            <div className="overflow-hidden">
              <div className="flex items-center gap-1 flex-wrap justify-end pr-2 pb-2 pt-0.5">
                {/* Response types */}
                {RESPONSE_TYPES.map((type, i) => {
                  const { icon: TypeIcon } = STEP_TYPE_CONFIG[type];
                  const isSelected = currentType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleTypeSelect(type); }}
                      className={cn(
                        "group/chip flex items-center h-[22px] w-[22px] justify-center rounded-sm transition-all focus:outline-none",
                        isSelected
                          ? "bg-white text-accent shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)]"
                          : "bg-transparent text-muted-foreground/70 hover:bg-card hover:shadow-[1px_2px_2px_0px_rgba(0,0,0,0.12),-2px_-2px_2px_0px_rgba(255,255,255,0.7)] hover:text-foreground/80"
                      )}
                      style={{
                        opacity: isFocused ? 1 : 0,
                        transform: isFocused ? "translateX(0)" : "translateX(-6px)",
                        transition: `opacity 0.15s ease ${i * 22}ms, transform 0.15s ease ${i * 22}ms`,
                      }}
                      title={STEP_TYPE_CONFIG[type].label}
                    >
                      <TypeIcon className="h-3 w-3 shrink-0" />
                    </button>
                  );
                })}

                {/* Thin separator between response and format types */}
                <div
                  className="w-px h-3.5 bg-muted-foreground/15 mx-0.5 shrink-0"
                  style={{
                    opacity: isFocused ? 1 : 0,
                    transition: `opacity 0.15s ease ${RESPONSE_TYPES.length * 22}ms`,
                  }}
                />

                {/* Format types — teal tint */}
                {(["title", "note", "sub_step", "divider"] as StepType[]).map((type, i) => {
                  const { icon: TypeIcon } = STEP_TYPE_CONFIG[type];
                  const isSelected = currentType === type;
                  const delay = (RESPONSE_TYPES.length + 1 + i) * 22;
                  return (
                    <button
                      key={type}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleTypeSelect(type); }}
                      className={cn(
                        "group/chip flex items-center h-[22px] w-[22px] justify-center rounded-sm transition-all focus:outline-none",
                        isSelected
                          ? "bg-white shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)]"
                          : "bg-transparent hover:bg-card hover:shadow-[1px_2px_2px_0px_rgba(0,0,0,0.12),-2px_-2px_2px_0px_rgba(255,255,255,0.7)]"
                      )}
                      style={{
                        color: isSelected ? "rgba(142,201,206,1)" : "rgba(42,41,62,0.5)",
                        opacity: isFocused ? 1 : 0,
                        transform: isFocused ? "translateX(0)" : "translateX(-6px)",
                        transition: `opacity 0.15s ease ${delay}ms, transform 0.15s ease ${delay}ms, color 0.1s`,
                      }}
                      title={STEP_TYPE_CONFIG[type].label}
                    >
                      <TypeIcon className="h-3 w-3 shrink-0" />
                    </button>
                  );
                })}

                {/* Outdent — only when current type is sub_step */}
                {isSubStep && (
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleTypeSelect("check"); }}
                    className="flex items-center h-[22px] w-[22px] justify-center rounded-sm bg-transparent transition-all focus:outline-none hover:bg-card hover:shadow-[1px_2px_2px_0px_rgba(0,0,0,0.12),-2px_-2px_2px_0px_rgba(255,255,255,0.7)]"
                    style={{
                      color: "rgba(42,41,62,0.5)",
                      opacity: isFocused ? 1 : 0,
                      transform: isFocused ? "translateX(0)" : "translateX(-6px)",
                      transition: `opacity 0.15s ease ${(RESPONSE_TYPES.length + 5) * 22}ms, transform 0.15s ease ${(RESPONSE_TYPES.length + 5) * 22}ms`,
                    }}
                    title="Outdent"
                  >
                    <Outdent className="h-3 w-3 shrink-0" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Below-row affordance for text type */}
        {currentType === "text" && (
          <div className="ml-[46px] mr-2 pb-2 -mt-0.5">
            <div className="h-7 rounded-md px-2.5 flex items-center bg-card shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08),inset_-1px_-1px_2px_rgba(255,255,255,0.5)] text-xs text-muted-foreground/40 italic">
              Type your answer…
            </div>
          </div>
        )}

        {/* ── Follow-up Branch (if failed) ─────────────────────────── */}
        {subtask.has_followup_if_failed && (
          <div className="ml-[22px] pb-1.5">
            {/* "If Failed →" label with connector */}
            <div className="flex items-center gap-1 mb-0.5 pl-[2px]">
              <div className="w-[1px] h-2.5 bg-amber-300/40 shrink-0" />
              <GitBranch className="h-2.5 w-2.5 text-amber-400/60 shrink-0" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-amber-500/50">
                If Failed
              </span>
            </div>

            {/* Follow-up step row */}
            <div className="flex items-center gap-[3px] border-l-[2px] border-amber-200/40 pl-2 min-h-[30px]">
              <Check className="h-3 w-3 shrink-0 text-amber-400/50" />
              <input
                type="text"
                placeholder="Follow-up action…"
                value={subtask.followup?.title ?? ""}
                onChange={(e) =>
                  onUpdate(subtask.id, {
                    followup: {
                      title: e.target.value,
                      step_type: subtask.followup?.step_type ?? "check",
                    },
                  })
                }
                className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13px] placeholder:text-muted-foreground/30"
                style={{ color: "rgba(42, 41, 62, 0.70)" }}
              />
            </div>
          </div>
        )}

        {/* ── Inline Note ──────────────────────────────────────────── */}
        {subtask.note && (
          <div className="group/note flex items-start gap-[3px] ml-[24px] mr-[36px] pb-2 -mt-0.5">
            {/* Avatar in type icon position */}
            <div
              className="h-6 w-6 shrink-0 flex items-center justify-center rounded-full mt-0.5 overflow-hidden"
              style={{ backgroundColor: subtask.note.created_by_avatar ? undefined : stringToColor(subtask.note.created_by_name) }}
            >
              {subtask.note.created_by_avatar ? (
                <img
                  src={subtask.note.created_by_avatar}
                  alt={subtask.note.created_by_name ?? "Note author"}
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <span className="text-[10px] font-semibold text-white leading-none select-none">
                  {getInitials(subtask.note.created_by_name)}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <Textarea
                ref={noteRef}
                placeholder="Add a note…"
                value={subtask.note.text}
                onChange={(e) =>
                  onUpdate(subtask.id, {
                    note: { ...subtask.note!, text: e.target.value },
                  })
                }
                className="w-full border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 resize-none overflow-y-auto min-h-[20px] max-h-[96px]"
                style={{
                  fontSize: "14px",
                  color: "rgba(42, 41, 62, 0.75)",
                  paddingTop: "2px",
                  paddingBottom: "0px",
                }}
                rows={1}
              />
              <p className="text-[10px] opacity-90 leading-tight" style={{ color: "rgba(133, 186, 188, 1)" }}>
                {formatNoteDate(subtask.note.created_at)}
                {subtask.note.created_by_name && ` · ${subtask.note.created_by_name}`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onUpdate(subtask.id, { note: undefined })}
              className="shrink-0 h-5 w-5 flex items-center justify-center rounded opacity-0 group-hover/note:opacity-100 transition-opacity mt-0.5"
              aria-label="Remove note"
            >
              <X className="h-3 w-3 text-muted-foreground/60" />
            </button>
          </div>
        )}
      </div>

      {/* ── Assign to User Dialog ─────────────────────────────────── */}
      <Dialog open={assignPickerOpen} onOpenChange={setAssignPickerOpen}>
        <DialogContent className="bg-card border-0 shadow-e2 rounded-2xl max-w-xs p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Assign to User</DialogTitle>
          </DialogHeader>

          {/* Search */}
          <input
            type="text"
            placeholder="Search members…"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="w-full h-8 rounded-lg bg-background/50 px-3 text-sm border-0 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08),inset_-1px_-1px_2px_rgba(255,255,255,0.5)] focus:outline-none placeholder:text-muted-foreground/50"
          />

          {/* Member list */}
          <div className="mt-2 space-y-0.5 max-h-48 overflow-y-auto">
            {filteredMembers.length === 0 && (
              <p className="text-xs text-muted-foreground/50 text-center py-3">
                No members found
              </p>
            )}
            {filteredMembers.map((member) => {
              const isAssigned = subtask.assigned_user_id === member.user_id;
              return (
                <button
                  key={member.user_id}
                  type="button"
                  onClick={() => handleAssignUser(member)}
                  className={cn(
                    "w-full flex items-center gap-2 h-9 px-2 rounded-lg text-sm transition-all",
                    isAssigned
                      ? "bg-accent/10 text-accent"
                      : "text-foreground hover:bg-muted/40"
                  )}
                >
                  <div className="h-6 w-6 shrink-0 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold uppercase">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} className="h-6 w-6 rounded-full object-cover" alt="" />
                    ) : (
                      member.display_name.charAt(0)
                    )}
                  </div>
                  <span className="flex-1 text-left truncate">{member.display_name}</span>
                  {isAssigned && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                </button>
              );
            })}
          </div>

          {subtask.assigned_user_id && (
            <button
              type="button"
              onClick={handleUnassignUser}
              className="w-full mt-1 h-8 text-xs text-muted-foreground/60 hover:text-destructive transition-colors"
            >
              Remove assignment
            </button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
