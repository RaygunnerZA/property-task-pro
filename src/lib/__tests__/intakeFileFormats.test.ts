import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  blobForInboxFile,
  canExtractTextLocally,
  canOpenInBrowser,
  intakeFileKind,
  intakePreviewKind,
  normalizeInboxContentType,
} from "@/lib/intakeFileKind";
import { extractOfficePlainText } from "@/lib/officeDocumentText";
import {
  extractPdfEmbeddedImage,
  extractPdfPlainText,
  isPdfBytes,
} from "@/lib/pdfDocumentText";
import { buildIntakeDocumentBriefing } from "@/lib/intakeDocumentBriefing";
import type { IntakeSourceArtifact } from "@/types/intake-item";

const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  )
);

function crc32(bytes: Uint8Array): number {
  let crc = ~0;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return ~crc >>> 0;
}

function u16(n: number): Uint8Array {
  const view = new Uint8Array(2);
  new DataView(view.buffer).setUint16(0, n, true);
  return view;
}

function u32(n: number): Uint8Array {
  const view = new Uint8Array(4);
  new DataView(view.buffer).setUint32(0, n, true);
  return view;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function zipOneFile(path: string, xml: string): Uint8Array {
  const name = new TextEncoder().encode(path);
  const data = new TextEncoder().encode(xml);
  const compressed = deflateRawSync(data);
  const crc = crc32(data);
  const local = concat(
    Uint8Array.of(0x50, 0x4b, 0x03, 0x04),
    u16(20),
    u16(0),
    u16(8),
    u16(0),
    u16(0),
    u32(crc),
    u32(compressed.length),
    u32(data.length),
    u16(name.length),
    u16(0),
    name,
    compressed
  );
  const central = concat(
    Uint8Array.of(0x50, 0x4b, 0x01, 0x02),
    u16(20),
    u16(20),
    u16(0),
    u16(8),
    u16(0),
    u16(0),
    u32(crc),
    u32(compressed.length),
    u32(data.length),
    u16(name.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(0),
    name
  );
  const eocd = concat(
    Uint8Array.of(0x50, 0x4b, 0x05, 0x06),
    u16(0),
    u16(0),
    u16(1),
    u16(1),
    u32(central.length),
    u32(local.length),
    u16(0)
  );
  return concat(local, central, eocd);
}

function textPdf(lines: string[]): Uint8Array {
  const content = `BT ${lines.map((line) => `(${line}) Tj`).join(" ")} ET`;
  return new TextEncoder().encode(`%PDF-1.4\nstream\n${content}\nendstream\n%%EOF\n`);
}

function pdfWithPng(png: Uint8Array): Uint8Array {
  const header = new TextEncoder().encode("%PDF-1.4\nstream\n");
  const footer = new TextEncoder().encode("\nendstream\n%%EOF\n");
  return concat(header, png, footer);
}

function artifact(partial: Partial<IntakeSourceArtifact>): IntakeSourceArtifact {
  return {
    intakeItemId: "item-1",
    storagePath: "orgs/x/inbox/file",
    fileName: "upload.bin",
    mimeType: "application/octet-stream",
    aiClassification: null,
    aiExtracted: { metadata: { stub: true } },
    ...partial,
  };
}

describe("intake file formats can be opened and classified", () => {
  const cases = [
    {
      name: "04_energy_performance_certificate_valid.pdf",
      mime: "application/pdf",
      kind: "pdf",
      preview: "pdf",
      open: true,
      text: true,
    },
    {
      name: "05_fire_extinguisher_service_ambiguous_date.png",
      mime: "image/png",
      kind: "image",
      preview: "image",
      open: true,
      text: false,
    },
    {
      name: "03_electrical_condition_report_unsatisfactory.docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      kind: "office",
      preview: "office",
      open: false,
      text: true,
    },
    {
      name: "$_57.JPG",
      mime: "image/jpeg",
      kind: "image",
      preview: "image",
      open: true,
      text: false,
    },
    {
      name: "JustinPlunkett_Design Invoice-ZAG 5.docx.pdf",
      mime: "application/octet-stream",
      kind: "pdf",
      preview: "pdf",
      open: true,
      text: true,
    },
  ] as const;

  it.each(cases)("$name", (row) => {
    expect(intakeFileKind(row.mime, row.name)).toBe(row.kind);
    expect(intakePreviewKind(row.mime, row.name)).toBe(row.preview);
    expect(canOpenInBrowser(row.mime, row.name)).toBe(row.open);
    expect(canExtractTextLocally(row.mime, row.name)).toBe(row.text);
  });

  it("corrects empty MIME from the filename so PDFs open as PDFs", () => {
    expect(normalizeInboxContentType("", "certificate.pdf")).toBe("application/pdf");
    expect(blobForInboxFile(new Uint8Array([1, 2, 3]), "", "photo.JPG").type).toBe("image/jpeg");
  });
});

describe("local parsers extract key signals from representative files", () => {
  it("reads EPC type, validity and expiry from a digital PDF", async () => {
    const bytes = textPdf([
      "Energy Performance Certificate",
      "Certificate valid until: 11 March 2034",
    ]);
    expect(isPdfBytes(bytes)).toBe(true);
    const text = await extractPdfPlainText(bytes);
    expect(text).toMatch(/Energy Performance Certificate/);
    expect(text).toMatch(/11 March 2034/);

    const briefing = buildIntakeDocumentBriefing(
      artifact({
        fileName: "04_energy_performance_certificate_valid.pdf",
        mimeType: "application/pdf",
        aiClassification: "Misc",
        aiExtracted: { document_type: "Misc", metadata: { stub: true } },
      }),
      text
    );
    expect(briefing.documentType).toBe("EPC");
    expect(briefing.outcome).toBe("valid");
    expect(briefing.expiryDate).toBe("2034-03-11");
    expect(briefing.provenance).toBe("document");
    expect(briefing.title).toBe("EPC Record");
  });

  it("pulls a thumbnail image out of a scanned PDF", () => {
    const pdf = pdfWithPng(PNG_1X1);
    const image = extractPdfEmbeddedImage(pdf);
    expect(image).not.toBeNull();
    expect(image?.type).toBe("image/png");
    expect(image?.size).toBeGreaterThan(50);
  });

  it("reads EICR outcome from a Word document", async () => {
    const xml =
      "<w:p><w:r><w:t>Electrical Installation Condition Report</w:t></w:r></w:p>" +
      "<w:p><w:r><w:t>Overall assessment: Unsatisfactory</w:t></w:r></w:p>" +
      "<w:p><w:r><w:t>C2 defects require remedial action.</w:t></w:r></w:p>";
    const docx = zipOneFile("word/document.xml", xml);
    const text = await extractOfficePlainText(
      docx.slice().buffer as ArrayBuffer,
      "03_electrical_condition_report_unsatisfactory.docx"
    );
    expect(text).toMatch(/Electrical Installation Condition Report/);
    expect(text).toMatch(/Unsatisfactory/);

    const briefing = buildIntakeDocumentBriefing(
      artifact({
        fileName: "03_electrical_condition_report_unsatisfactory.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      text
    );
    expect(briefing.documentType).toBe("EICR");
    expect(briefing.outcome).toBe("unsatisfactory");
    expect(briefing.needsFollowUp).toBe(true);
    expect(briefing.provenance).toBe("document");
  });

  it("identifies a fire extinguisher service photo from the filename when OCR is empty", () => {
    const briefing = buildIntakeDocumentBriefing(
      artifact({
        fileName: "05_fire_extinguisher_service_ambiguous_date.png",
        mimeType: "image/png",
        aiClassification: "uncertain",
        aiExtracted: null,
      })
    );
    expect(briefing.documentType).toBe("Fire Extinguisher Service");
    expect(briefing.fileKindLabel).toBe("Photo");
  });

  it("identifies an invoice PDF even when AI only returned Misc", () => {
    const briefing = buildIntakeDocumentBriefing(
      artifact({
        fileName: "JustinPlunkett_Design Invoice-ZAG 5.docx.pdf",
        mimeType: "application/pdf",
        aiClassification: "Misc",
        aiExtracted: { document_type: "Misc", metadata: { stub: true, source: "filename" } },
      }),
      "INVOICE\nDesign services\nTotal due 1,200.00"
    );
    expect(briefing.documentType).toBe("Invoice");
    expect(briefing.provenance).toBe("document");
  });

  it("does not treat a random JPEG as a certificate when nothing can be read", () => {
    const briefing = buildIntakeDocumentBriefing(
      artifact({
        fileName: "$_57.JPG",
        mimeType: "image/jpeg",
        aiClassification: "uncertain",
        aiExtracted: null,
      })
    );
    expect(briefing.documentType).toBeNull();
    expect(briefing.fileKindLabel).toBe("Photo");
    expect(briefing.provenance).toBe("filename");
  });
});
