import { describe, expect, it } from "vitest";
import {
  membershipCanEditTaskDetails,
  parseFollowerUserIds,
  personInitials,
} from "../taskFollowers";

describe("personInitials", () => {
  it("uses first and last name letters", () => {
    expect(personInitials("Justin Plunkett")).toBe("JP");
  });

  it("joins multiple followers the way chips render", () => {
    const label = ["Justin Plunkett", "Greta Thorne", "Omar Blake"]
      .map(personInitials)
      .join(" | ");
    expect(label).toBe("JP | GT | OB");
  });
});

describe("membershipCanEditTaskDetails", () => {
  it("allows owners and managers even when they are not the assignee", () => {
    expect(
      membershipCanEditTaskDetails({
        role: "manager",
        userId: "u1",
        assignedUserId: "u2",
      })
    ).toBe(true);
  });

  it("allows the assigned staff member", () => {
    expect(
      membershipCanEditTaskDetails({
        role: "staff",
        userId: "u1",
        assignedUserId: "u1",
      })
    ).toBe(true);
  });

  it("denies a staff follower who is not assigned", () => {
    expect(
      membershipCanEditTaskDetails({
        role: "staff",
        userId: "follower",
        assignedUserId: "assignee",
      })
    ).toBe(false);
  });

  it("fails closed without a user", () => {
    expect(
      membershipCanEditTaskDetails({
        role: "owner",
        userId: null,
        assignedUserId: "u1",
      })
    ).toBe(false);
  });
});

describe("parseFollowerUserIds", () => {
  it("ignores malformed payloads", () => {
    expect(parseFollowerUserIds(null)).toEqual([]);
    expect(parseFollowerUserIds(["a", 1, ""])).toEqual(["a"]);
  });
});
