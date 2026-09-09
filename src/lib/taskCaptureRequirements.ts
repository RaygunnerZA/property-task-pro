/**
 * Org-level required fields on tasks (photo, location, category).
 * Policy is stored on org_settings; completion is also enforced in Postgres.
 */

export type TaskCaptureField = "photo" | "location" | "category";

export type TaskCaptureRequirements = {
  requirePhoto: boolean;
  requireLocation: boolean;
  requireCategory: boolean;
};

export type TaskCaptureSnapshot = {
  hasPhoto: boolean;
  hasLocation: boolean;
  hasCategory: boolean;
};

export type TaskCaptureSettingsRow = {
  require_task_photo?: boolean | null;
  require_task_location?: boolean | null;
  require_task_category?: boolean | null;
} | null;

const FIELD_COPY: Record<TaskCaptureField, string> = {
  photo: "a photo",
  location: "a location (property and space)",
  category: "a category",
};

const PHOTO_NAME_RE = /\.(jpe?g|png|gif|webp|heic|heif)(\?|$)/i;

export function parseTaskCaptureRequirements(
  settings: TaskCaptureSettingsRow
): TaskCaptureRequirements {
  return {
    requirePhoto: settings?.require_task_photo === true,
    requireLocation: settings?.require_task_location === true,
    requireCategory: settings?.require_task_category === true,
  };
}

export function hasTaskCaptureRequirements(req: TaskCaptureRequirements): boolean {
  return req.requirePhoto || req.requireLocation || req.requireCategory;
}

export function jsonListLength(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

export function isTaskPhotoAttachment(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const row = item as {
    file_type?: string | null;
    file_name?: string | null;
    file_url?: string | null;
    thumbnail_url?: string | null;
    metadata?: { evidence_kind?: string | null } | null;
  };
  const fileName = (row.file_name ?? "").toLowerCase();
  if (fileName.startsWith("signature.")) return false;
  if ((row.metadata?.evidence_kind ?? "") === "signature") return false;
  const type = (row.file_type ?? "").toLowerCase();
  if (type.startsWith("image/")) return true;
  const names = [row.file_name, row.file_url, row.thumbnail_url];
  return names.some((value) => PHOTO_NAME_RE.test(value ?? ""));
}

export function photoCountFromImages(images: unknown): number {
  if (Array.isArray(images)) {
    return images.filter(isTaskPhotoAttachment).length;
  }
  if (typeof images === "string" && images.trim()) {
    try {
      const parsed = JSON.parse(images) as unknown;
      return Array.isArray(parsed) ? parsed.filter(isTaskPhotoAttachment).length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

export function snapshotFromTaskView(task: {
  property_id?: string | null;
  spaces?: unknown;
  themes?: unknown;
  images?: unknown;
}): TaskCaptureSnapshot {
  return {
    hasPhoto: photoCountFromImages(task.images) > 0,
    hasLocation: Boolean(task.property_id) && jsonListLength(task.spaces) > 0,
    hasCategory: jsonListLength(task.themes) > 0,
  };
}

export function missingTaskCaptureFields(
  requirements: TaskCaptureRequirements,
  snapshot: TaskCaptureSnapshot
): TaskCaptureField[] {
  const missing: TaskCaptureField[] = [];
  if (requirements.requirePhoto && !snapshot.hasPhoto) missing.push("photo");
  if (requirements.requireLocation && !snapshot.hasLocation) missing.push("location");
  if (requirements.requireCategory && !snapshot.hasCategory) missing.push("category");
  return missing;
}

export function taskCaptureRequiredMessage(
  missing: TaskCaptureField[],
  action: "create" | "complete" = "complete"
): string {
  if (missing.length === 0) return "";
  const labels = missing.map((field) => FIELD_COPY[field]);
  const joined =
    labels.length === 1
      ? labels[0]
      : labels.length === 2
        ? `${labels[0]} and ${labels[1]}`
        : `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
  const verb = action === "create" ? "creating" : "completing";
  return `Add ${joined} before ${verb} this task.`;
}

export function isTaskCaptureRequiredError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : typeof error === "string"
          ? error
          : "";
  return message.includes("TASK_CAPTURE_REQUIRED");
}
