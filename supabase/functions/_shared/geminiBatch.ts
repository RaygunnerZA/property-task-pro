/**
 * Gemini Batch REST helpers (inline requests).
 * Results are untrusted model output — callers must re-validate.
 */

import {
  GEMINI_FLASH_MODEL,
  geminiBatchGenerateContentUrl,
  geminiBatchGetUrl,
} from "./geminiKeys.ts";
import { geminiUsage, type TokenUsage } from "./aiObservability.ts";
import { parseJsonLoose } from "./aiRouting.ts";

export type GeminiBatchRequest = {
  key: string;
  system: string;
  user: string;
  temperature?: number;
  json?: boolean;
};

export type GeminiInlinedResult = {
  key: string | null;
  text: string | null;
  raw: unknown;
  usage: TokenUsage;
  error: string | null;
};

export type GeminiBatchJobSnapshot = {
  name: string;
  state: string;
  raw: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractTextFromGenerateContent(response: unknown): string | null {
  const rec = asRecord(response);
  const candidates = rec?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    if (typeof rec?.text === "string") return rec.text;
    return null;
  }
  const first = asRecord(candidates[0]);
  const content = asRecord(first?.content);
  const parts = content?.parts;
  if (!Array.isArray(parts)) return null;
  const texts: string[] = [];
  for (const part of parts) {
    const p = asRecord(part);
    if (typeof p?.text === "string") texts.push(p.text);
  }
  return texts.join("") || null;
}

export function mapGeminiBatchState(
  state: string | undefined
): "submitted" | "running" | "succeeded" | "failed" | "cancelled" {
  const s = (state ?? "").toUpperCase();
  if (s === "JOB_STATE_SUCCEEDED") return "succeeded";
  if (s === "JOB_STATE_FAILED") return "failed";
  if (s === "JOB_STATE_CANCELLED" || s === "JOB_STATE_EXPIRED") return "cancelled";
  if (s === "JOB_STATE_RUNNING") return "running";
  return "submitted";
}

export async function createGeminiInlineBatch(params: {
  apiKey: string;
  displayName: string;
  requests: GeminiBatchRequest[];
  model?: string;
}): Promise<{ name: string; raw: Record<string, unknown> }> {
  const model = params.model ?? GEMINI_FLASH_MODEL;
  const url = geminiBatchGenerateContentUrl(model, params.apiKey);
  const requests = params.requests.map((item) => ({
    request: {
      systemInstruction: { parts: [{ text: item.system }] },
      contents: [{ role: "user", parts: [{ text: item.user }] }],
      generationConfig: {
        temperature: item.temperature ?? 0.2,
        ...(item.json !== false ? { responseMimeType: "application/json" } : {}),
      },
    },
    metadata: { key: item.key.slice(0, 128) },
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      batch: {
        displayName: params.displayName.slice(0, 128),
        inputConfig: {
          requests: { requests },
        },
      },
    }),
  });
  const rawText = await res.text();
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    raw = { parse_error: true, body: rawText.slice(0, 400) };
  }
  if (!res.ok) {
    throw new Error(`Gemini batch create ${res.status}: ${rawText.slice(0, 280)}`);
  }
  const name =
    (typeof raw.name === "string" && raw.name) ||
    (typeof asRecord(raw.batch)?.name === "string" && (asRecord(raw.batch)!.name as string)) ||
    (typeof raw.batchName === "string" && raw.batchName) ||
    "";
  if (!name.startsWith("batches/")) {
    throw new Error("Gemini batch create did not return a batches/ name");
  }
  return { name, raw };
}

export async function getGeminiBatch(
  apiKey: string,
  batchName: string
): Promise<GeminiBatchJobSnapshot> {
  const res = await fetch(geminiBatchGetUrl(batchName, apiKey), {
    method: "GET",
  });
  const rawText = await res.text();
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    throw new Error(`Gemini batch get returned non-JSON (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(`Gemini batch get ${res.status}: ${rawText.slice(0, 280)}`);
  }
  const metadata = asRecord(raw.metadata);
  const state =
    (typeof raw.state === "string" && raw.state) ||
    (typeof metadata?.state === "string" && metadata.state) ||
    "JOB_STATE_PENDING";
  const name = typeof raw.name === "string" && raw.name ? raw.name : batchName;
  return { name, state, raw };
}

export function extractGeminiInlinedResults(
  snapshot: GeminiBatchJobSnapshot
): GeminiInlinedResult[] {
  const raw = snapshot.raw;
  const dest = asRecord(raw.dest) ?? asRecord(asRecord(raw.response)?.dest);
  const response = asRecord(raw.response);
  const lists = [
    dest?.inlinedResponses,
    response?.inlinedResponses,
    raw.inlinedResponses,
    asRecord(raw.metadata)?.inlinedResponses,
  ];
  let rows: unknown[] = [];
  for (const list of lists) {
    if (Array.isArray(list) && list.length > 0) {
      rows = list;
      break;
    }
  }

  return rows.map((row, index) => {
    const rec = asRecord(row) ?? {};
    const metadata = asRecord(rec.metadata);
    const key =
      (typeof metadata?.key === "string" && metadata.key) ||
      (typeof rec.key === "string" && rec.key) ||
      null;
    const errObj = rec.error ?? rec.status;
    let error: string | null = null;
    if (typeof errObj === "string") error = errObj;
    else if (asRecord(errObj)?.message) error = String(asRecord(errObj)!.message);
    const generate = rec.response ?? rec.generateContentResponse ?? rec;
    const text = extractTextFromGenerateContent(generate);
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = parseJsonLoose(text);
      } catch {
        parsed = null;
      }
    }
    return {
      key: key ?? String(index),
      text,
      raw: parsed ?? generate,
      usage: geminiUsage(generate),
      error,
    };
  });
}
