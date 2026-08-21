import type { DragEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  dataTransferFiles,
  dataTransferHasFiles,
  fileDropBind,
} from "@/utils/ingestIntakeMediaFiles";

function mockDataTransfer(files: File[], types: string[] = ["Files"]): DataTransfer {
  return {
    files: {
      length: files.length,
      item: (i: number) => files[i] ?? null,
      ...files,
      [Symbol.iterator]: function* () {
        yield* files;
      },
    } as unknown as FileList,
    types,
  } as unknown as DataTransfer;
}

describe("dataTransfer file drop helpers", () => {
  it("detects a Files drag payload", () => {
    expect(dataTransferHasFiles(mockDataTransfer([], ["Files"]))).toBe(true);
    expect(dataTransferHasFiles(mockDataTransfer([], ["text/plain"]))).toBe(false);
    expect(dataTransferHasFiles(null)).toBe(false);
  });

  it("reads dropped files", () => {
    const photo = new File(["x"], "boiler.jpg", { type: "image/jpeg" });
    const pdf = new File(["y"], "cert.pdf", { type: "application/pdf" });
    expect(dataTransferFiles(mockDataTransfer([photo, pdf]))).toEqual([photo, pdf]);
    expect(dataTransferFiles(null)).toEqual([]);
  });

  it("intercepts file drops in capture so nested text fields cannot swallow them", () => {
    const pdf = new File(["y"], "cert.pdf", { type: "application/pdf" });
    const onFiles = vi.fn();
    const bind = fileDropBind(onFiles);

    expect(bind).toHaveProperty("onDropCapture");
    expect(bind).not.toHaveProperty("onDrop");

    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    bind.onDropCapture({
      dataTransfer: mockDataTransfer([pdf]),
      preventDefault,
      stopPropagation,
    } as unknown as DragEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(onFiles).toHaveBeenCalledWith([pdf]);
  });
});
