import { describe, expect, it } from "vitest";
import {
  hasTaskCaptureRequirements,
  isTaskCaptureRequiredError,
  isTaskPhotoAttachment,
  jsonListLength,
  missingTaskCaptureFields,
  parseTaskCaptureRequirements,
  photoCountFromImages,
  snapshotFromTaskView,
  taskCaptureRequiredMessage,
} from "../taskCaptureRequirements";

describe("parseTaskCaptureRequirements", () => {
  it("defaults all flags off when settings are missing", () => {
    expect(parseTaskCaptureRequirements(null)).toEqual({
      requirePhoto: false,
      requireLocation: false,
      requireCategory: false,
    });
    expect(hasTaskCaptureRequirements(parseTaskCaptureRequirements(null))).toBe(false);
  });

  it("treats only explicit true as required", () => {
    expect(
      parseTaskCaptureRequirements({
        require_task_photo: true,
        require_task_location: false,
        require_task_category: null,
      })
    ).toEqual({
      requirePhoto: true,
      requireLocation: false,
      requireCategory: false,
    });
  });
});

describe("missingTaskCaptureFields", () => {
  const allOn = {
    requirePhoto: true,
    requireLocation: true,
    requireCategory: true,
  };

  it("returns nothing when requirements are off", () => {
    expect(
      missingTaskCaptureFields(
        parseTaskCaptureRequirements(null),
        { hasPhoto: false, hasLocation: false, hasCategory: false }
      )
    ).toEqual([]);
  });

  it("lists each missing required field", () => {
    expect(
      missingTaskCaptureFields(allOn, {
        hasPhoto: false,
        hasLocation: true,
        hasCategory: false,
      })
    ).toEqual(["photo", "category"]);
  });

  it("passes when the snapshot is complete", () => {
    expect(
      missingTaskCaptureFields(allOn, {
        hasPhoto: true,
        hasLocation: true,
        hasCategory: true,
      })
    ).toEqual([]);
  });
});

describe("snapshotFromTaskView", () => {
  it("requires property and at least one space for location", () => {
    expect(
      snapshotFromTaskView({
        property_id: "p1",
        spaces: [],
        themes: [{ id: "t1" }],
        images: [{ file_type: "image/jpeg" }],
      })
    ).toEqual({
      hasPhoto: true,
      hasLocation: false,
      hasCategory: true,
    });

    expect(
      snapshotFromTaskView({
        property_id: "p1",
        spaces: JSON.stringify([{ id: "s1", name: "Kitchen" }]),
        themes: "[]",
        images: [],
      }).hasLocation
    ).toBe(true);
  });

  it("ignores signature-like non-image attachments", () => {
    expect(
      photoCountFromImages([
        { file_type: "application/pdf", file_name: "report.pdf" },
        { file_type: "image/png", file_name: "before.png" },
      ])
    ).toBe(1);
    expect(isTaskPhotoAttachment({ file_name: "signature.png", file_type: "image/png" })).toBe(
      false
    );
    expect(isTaskPhotoAttachment({ file_name: "photo.HEIC" })).toBe(true);
    expect(jsonListLength(null)).toBe(0);
  });
});

describe("taskCaptureRequiredMessage", () => {
  it("uses create vs complete copy", () => {
    expect(taskCaptureRequiredMessage(["photo"], "create")).toBe(
      "Add a photo before creating this task."
    );
    expect(taskCaptureRequiredMessage(["photo", "location"], "complete")).toBe(
      "Add a photo and a location (property and space) before completing this task."
    );
    expect(taskCaptureRequiredMessage(["photo", "location", "category"])).toContain(
      "a category"
    );
  });
});

describe("isTaskCaptureRequiredError", () => {
  it("detects the database exception prefix", () => {
    expect(
      isTaskCaptureRequiredError(
        new Error("TASK_CAPTURE_REQUIRED: Add a photo before completing this task.")
      )
    ).toBe(true);
    expect(isTaskCaptureRequiredError(new Error("Failed to complete task"))).toBe(false);
  });
});
