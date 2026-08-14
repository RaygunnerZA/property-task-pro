import { describe, expect, it } from "vitest";
import {
  dataTransferFiles,
  dataTransferHasFiles,
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
});
