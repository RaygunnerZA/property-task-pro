export type PublicPlanId = "home" | "home_plus" | "portfolio" | "business";

export interface PublicPlan {
  id: PublicPlanId;
  name: string;
  buyer: string;
  scope: string;
  points: string[];
  cta: { label: string; path: string };
  featured?: boolean;
  conversation?: boolean;
}

/** Public plan copy — mirrors @Docs/20_Billing.md. Do not invent prices here. */
export const PUBLIC_PLANS: PublicPlan[] = [
  {
    id: "home",
    name: "Home",
    buyer: "I manage my own home.",
    scope: "1 active property · 1 coordinating member",
    points: [
      "Tasks, checklists, and basic evidence",
      "Basic signals",
      "Self-service support",
    ],
    cta: { label: "Start Home — free", path: "/signup" },
    featured: true,
  },
  {
    id: "home_plus",
    name: "Home Plus",
    buyer: "Other people help me manage my home.",
    scope: "1 active property · coordinating + staff",
    points: [
      "Invite people who help on one property",
      "External submissions",
      "Standard email support",
    ],
    cta: { label: "Start from Home", path: "/signup" },
  },
  {
    id: "portfolio",
    name: "Portfolio",
    buyer: "I coordinate operations across several properties.",
    scope: "Property bands · multi-property ops",
    points: [
      "Property assignments and portfolio views",
      "Pooled staff, evidence, and AI allowances",
      "Priority email and guided setup",
    ],
    cta: { label: "Start from Home", path: "/signup" },
  },
  {
    id: "business",
    name: "Business",
    buyer: "We govern property operations across teams and locations.",
    scope: "Governance, compliance depth, admin controls",
    points: [
      "Approvals, audit export, advanced reporting",
      "Centralised administration",
      "Priority support and administrator onboarding",
    ],
    cta: { label: "Talk about Business", path: "/signup" },
    conversation: true,
  },
];
