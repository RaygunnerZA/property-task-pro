import type { DevUserRole } from "@/context/DevModeContext";

/** Stable dev test account IDs (shown in DevTools as TEST-01 … TEST-06). */
export type TestPersonaId =
  | "test-01"
  | "test-02"
  | "test-03"
  | "test-04"
  | "test-05"
  | "test-06";

export interface TestPersona {
  id: TestPersonaId;
  /** e.g. TEST-01 */
  testId: string;
  label: string;
  email: string;
  /** Target `organisation_members.role` when seeding the active org. */
  membershipRole: "owner" | "manager" | "member" | "staff";
  /**
   * Optional UI-only override via DevMode (contractor/vendor/admin experiences).
   * Null = use real membership role only.
   */
  uiRoleOverride: DevUserRole | null;
  scenarioRole: string;
}

export const DEV_ROLEPLAY_MARKER = "[DEV] Role-play:";
export const DEV_ROLEPLAY_CONVERSATION_REF = "dev_roleplay_scenario_v1";

export const TEST_PERSONAS: TestPersona[] = [
  {
    id: "test-01",
    testId: "TEST-01",
    label: "Alice Staff",
    email: "justinplunkett+alice@gmail.com",
    membershipRole: "staff",
    uiRoleOverride: null,
    scenarioRole: "Field staff — assigned work & task threads",
  },
  {
    id: "test-02",
    testId: "TEST-02",
    label: "Bob Worker",
    email: "justinplunkett+bob@gmail.com",
    membershipRole: "staff",
    uiRoleOverride: null,
    scenarioRole: "Second staff — handoffs & shared property work",
  },
  {
    id: "test-03",
    testId: "TEST-03",
    label: "Carol Manager",
    email: "justinplunkett+carol@gmail.com",
    membershipRole: "manager",
    uiRoleOverride: "manager",
    scenarioRole: "Manager — assigns tasks & coordinates messaging",
  },
  {
    id: "test-04",
    testId: "TEST-04",
    label: "David Member",
    email: "justinplunkett+david@gmail.com",
    membershipRole: "member",
    uiRoleOverride: null,
    scenarioRole: "Member — broader org visibility",
  },
  {
    id: "test-05",
    testId: "TEST-05",
    label: "Emma Technician",
    email: "justinplunkett+emma@gmail.com",
    membershipRole: "staff",
    uiRoleOverride: "contractor",
    scenarioRole: "Technician — contractor-style task UX",
  },
  {
    id: "test-06",
    testId: "TEST-06",
    label: "Frank Vendor",
    email: "justinplunkett+frank@gmail.com",
    membershipRole: "member",
    uiRoleOverride: "vendor",
    scenarioRole: "Vendor — supplier threads on active jobs",
  },
];

export const TEST_PERSONA_STORAGE_KEY = "filla_dev_test_persona_id";
/** Org to keep active after switching test users (same org you were testing in). */
export const TEST_PERSONA_ORG_STORAGE_KEY = "filla_dev_test_persona_org_id";

export function getTestPersonaPassword(): string {
  return import.meta.env.VITE_DEV_TEST_PASSWORD ?? "TestPassword123!";
}

export function findTestPersona(id: TestPersonaId): TestPersona | undefined {
  return TEST_PERSONAS.find((p) => p.id === id);
}

export function findTestPersonaByEmail(email: string): TestPersona | undefined {
  const normalized = email.trim().toLowerCase();
  return TEST_PERSONAS.find((p) => p.email.toLowerCase() === normalized);
}
