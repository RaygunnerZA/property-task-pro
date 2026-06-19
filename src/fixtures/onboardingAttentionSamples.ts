import type { AttentionItem } from "@/components/dashboard/issues/issuesAttentionItem";

const EXAMPLE = "Example";

function reviewItem(
  id: string,
  title: string,
  description: string,
  actionLabel: string,
  imageUrl: string
): AttentionItem {
  return {
    id: `onboarding:review:${id}`,
    group: "review",
    title,
    context: EXAMPLE,
    description,
    whyHere: "Filla needs your judgement before routing this.",
    isUiFixture: true,
    isOnboardingExample: true,
    imageUrl,
    fixtureActions: {
      primary: { id: "signal-review", label: actionLabel },
      secondary: [{ id: "dismiss", label: "Dismiss" }],
    },
  };
}

function recentSignal(
  id: string,
  title: string,
  description: string,
  imageUrl: string,
  kind: AttentionItem["signalKind"] = "ai_suggestion"
): AttentionItem {
  return {
    id: `onboarding:signal:${id}`,
    group: "recent",
    title,
    context: `Confidence: ${EXAMPLE}`,
    description,
    signalKind: kind,
    footChipLabel: "SIGNAL",
    isUiFixture: true,
    isOnboardingExample: true,
    imageUrl,
    confidenceLevel: "medium",
    fixtureActions: {
      primary: { id: "signal-open", label: "Review" },
      secondary: [{ id: "dismiss", label: "Dismiss" }],
    },
  };
}

function recordItem(id: string, title: string, category: string, imageUrl: string): AttentionItem {
  return {
    id: `onboarding:record:${id}`,
    group: "review",
    title,
    context: `Suggested category: ${category}`,
    description: `${EXAMPLE} — Filla can organise and monitor records like this once you upload documents.`,
    isUiFixture: true,
    isOnboardingExample: true,
    imageUrl,
    fixtureActions: {
      primary: { id: "signal-convert", label: "Categorise" },
      secondary: [{ id: "dismiss", label: "Dismiss" }],
    },
    complianceSeed: {
      title,
      propertyName: "Your property",
      complianceType: category,
    },
  };
}

function quickWin(id: string, title: string, subtitle: string, imageUrl: string): AttentionItem {
  return {
    id: `onboarding:quick:${id}`,
    group: "recent",
    title,
    context: subtitle,
    description: `${EXAMPLE} — complete in under a minute to see how Filla works.`,
    footChipLabel: "QUICK WIN",
    isUiFixture: true,
    isOnboardingExample: true,
    imageUrl,
    fixtureActions: {
      primary: { id: "onboarding-quick-win", label: "Start" },
    },
  };
}

/** Needs review queue — education examples (DB tasks also seeded; these reinforce Attention UI). */
export const ONBOARDING_NEEDS_ATTENTION: AttentionItem[] = [
  reviewItem(
    "fire-ext",
    "Review Fire Extinguisher Certificate",
    "A certificate was uploaded but needs confirmation.",
    "Review",
    "/spaces/mini-cards/first-aid.png"
  ),
  reviewItem(
    "boiler",
    "Boiler Service Due Soon",
    "Annual service due in 14 days.",
    "Schedule",
    "/spaces/mini-cards/boiler-room.png"
  ),
  reviewItem(
    "unknown-doc",
    "Unknown Document Uploaded",
    "Filla couldn't identify a recently uploaded file.",
    "Categorise",
    "/spaces/mini-cards/archive-room.png"
  ),
];

/** Signals — demonstrate AI value. */
export const ONBOARDING_SIGNALS: AttentionItem[] = [
  recentSignal(
    "electricity",
    "High Electricity Usage",
    "Energy use increased compared to last month.",
    "/spaces/mini-cards/electrical-room.png",
    "ai_warning"
  ),
  recentSignal(
    "rain",
    "Heavy Rain Expected This Week",
    "Check roofs, gutters, and drainage.",
    "/spaces/mini-cards/garden.png",
    "weather"
  ),
  recentSignal(
    "fire-cert",
    "Fire Safety Certificate Expires Soon",
    "Expiry detected in uploaded document.",
    "/spaces/mini-cards/first-aid.png",
    "document"
  ),
  recentSignal(
    "warranty",
    "Boiler Warranty Found",
    "Warranty document identified and linked to asset.",
    "/spaces/mini-cards/boiler-room.png",
    "ai_suggestion"
  ),
  recentSignal(
    "multi-review",
    "Multiple Documents Need Review",
    "Filla found information but needs confirmation.",
    "/spaces/mini-cards/archive-room.png",
    "upload"
  ),
];

/** Records to organise — education examples. */
export const ONBOARDING_RECORDS: AttentionItem[] = [
  recordItem("insurance", "Building Insurance Policy", "Insurance", "/spaces/mini-cards/archive-room.png"),
  recordItem("lighting", "Emergency Lighting Report", "Compliance", "/spaces/mini-cards/electrical-room.png"),
  recordItem("water", "Water System Inspection", "Maintenance", "/spaces/mini-cards/boiler-room.png"),
];

/** Quick wins — fast actions. */
export const ONBOARDING_QUICK_WINS: AttentionItem[] = [
  quickWin("profile", "Complete Your Property Profile", "80% complete", "/spaces/mini-cards/office.png"),
  quickWin("asset", "Add Your First Asset", "Boilers, lifts, vehicles, appliances", "/spaces/mini-cards/plant-room.png"),
  quickWin("upload", "Upload One Document", "Drag and drop any PDF or image", "/spaces/mini-cards/archive-room.png"),
  quickWin("task", "Create Your First Task", "See how Filla organises work", "/spaces/mini-cards/kitchen.png"),
];

export const ONBOARDING_EDUCATION_SUMMARY = {
  residential:
    "Good start. Filla has created spaces and identified opportunities to improve organisation. Upload a document or create a task to see Filla begin learning about your property.",
  commercial:
    "Your property is set up. Add documents, assets, and team members to unlock compliance monitoring, maintenance tracking, and automated signals.",
} as const;
