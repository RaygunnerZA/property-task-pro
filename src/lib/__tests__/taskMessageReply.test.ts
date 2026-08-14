import { describe, expect, it } from "vitest";
import {
  buildReplyPayload,
  firstThreeLines,
  parseMessageReplyTo,
} from "../taskMessageReply";

describe("firstThreeLines", () => {
  it("keeps the first three newline-separated lines", () => {
    expect(firstThreeLines("one\ntwo\nthree\nfour")).toBe("one\ntwo\nthree");
  });

  it("returns a single paragraph unchanged", () => {
    expect(firstThreeLines("just one line")).toBe("just one line");
  });

  it("normalizes Windows newlines", () => {
    expect(firstThreeLines("a\r\nb\r\nc\r\nd")).toBe("a\nb\nc");
  });
});

describe("parseMessageReplyTo", () => {
  it("reads a reply_to payload", () => {
    expect(
      parseMessageReplyTo({
        reply_to: { id: "m1", author_name: "Ada", excerpt: "hello" },
      })
    ).toEqual({ id: "m1", author_name: "Ada", excerpt: "hello" });
  });

  it("returns null when the payload is missing or incomplete", () => {
    expect(parseMessageReplyTo(null)).toBeNull();
    expect(parseMessageReplyTo({})).toBeNull();
    expect(parseMessageReplyTo({ reply_to: { id: "m1" } })).toBeNull();
  });
});

describe("buildReplyPayload", () => {
  it("nests reply_to for messages.raw_payload", () => {
    expect(
      buildReplyPayload({ id: "m1", author_name: "Ada", excerpt: "hello" })
    ).toEqual({
      reply_to: { id: "m1", author_name: "Ada", excerpt: "hello" },
    });
  });
});
