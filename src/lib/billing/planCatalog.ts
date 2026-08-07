/**
 * Public plan catalog for comparison / checkout — display only.
 * Feature gates must use entitlement keys (@Docs/20_Billing.md §20.0).
 */

export type PlanTierId =
  | "home"
  | "home_plus"
  | "portfolio_2_5"
  | "portfolio_6_15"
  | "portfolio_16_40"
  | "business";

export type UpgradeMoment =
  | "second_coordinating_invite"
  | "second_property"
  | "coordinating_seats"
  | "staff_collaboration"
  | "governance"
  | "seat_addon"
  | "payment_recovery";

export type PlanCatalogEntry = {
  id: PlanTierId;
  name: string;
  buyerStatement: string;
  family: "personal" | "business";
  /** Checkout-eligible paid tiers */
  checkoutEligible: boolean;
  highlights: string[];
  properties: string;
  coordinating: string;
};

export const PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    id: "home",
    name: "Home",
    buyerStatement: "I manage my own home.",
    family: "personal",
    checkoutEligible: false,
    highlights: ["Core tasks & checklists", "Basic evidence", "Self-service support"],
    properties: "1 active property",
    coordinating: "1 coordinating member",
  },
  {
    id: "home_plus",
    name: "Home Plus",
    buyerStatement: "Other people help me manage my home.",
    family: "personal",
    checkoutEligible: true,
    highlights: [
      "Staff collaboration",
      "External submissions",
      "Larger evidence allowance",
    ],
    properties: "1 active property",
    coordinating: "Up to 5 coordinating seats",
  },
  {
    id: "portfolio_2_5",
    name: "Portfolio (2–5)",
    buyerStatement: "I coordinate operations across several properties.",
    family: "business",
    checkoutEligible: true,
    highlights: [
      "Multi-property navigation",
      "Property assignments",
      "Basic compliance",
    ],
    properties: "2–5 active properties",
    coordinating: "5 coordinating seats included",
  },
  {
    id: "portfolio_6_15",
    name: "Portfolio (6–15)",
    buyerStatement: "Growing portfolio operations.",
    family: "business",
    checkoutEligible: true,
    highlights: ["Advanced reports", "Larger Staff & evidence pools"],
    properties: "6–15 active properties",
    coordinating: "10 coordinating seats included",
  },
  {
    id: "portfolio_16_40",
    name: "Portfolio (16–40)",
    buyerStatement: "Large multi-site coordination.",
    family: "business",
    checkoutEligible: true,
    highlights: ["Priority support resources", "Higher AI & storage allowances"],
    properties: "16–40 active properties",
    coordinating: "20 coordinating seats included",
  },
  {
    id: "business",
    name: "Business",
    buyerStatement: "We govern property operations across teams and locations.",
    family: "business",
    checkoutEligible: true,
    highlights: [
      "Governance: audit export & retention",
      "API keys & admin controls",
      "SSO entitlement · approval workflows (roadmap)",
    ],
    properties: "Up to 100 active properties",
    coordinating: "50 coordinating seats included",
  },
];

/** Contextual upgrade offer per §20.8 */
export function recommendTierForMoment(moment: UpgradeMoment): PlanTierId | "seat_addon" {
  switch (moment) {
    case "second_coordinating_invite":
    case "staff_collaboration":
      return "home_plus";
    case "second_property":
      return "portfolio_2_5";
    case "coordinating_seats":
    case "seat_addon":
      return "seat_addon";
    case "governance":
      return "business";
    case "payment_recovery":
      return "home_plus";
    default:
      return "home_plus";
  }
}

export function upgradeCopy(moment: UpgradeMoment): {
  title: string;
  description: string;
  cta: string;
} {
  switch (moment) {
    case "second_coordinating_invite":
      return {
        title: "Invite another coordinator",
        description: "Home includes one Owner/Manager seat. Home Plus adds coordinating seats and Staff collaboration.",
        cta: "Upgrade to Home Plus",
      };
    case "staff_collaboration":
      return {
        title: "Invite Staff helpers",
        description: "Home does not include Staff collaboration. Upgrade to Home Plus to invite helpers.",
        cta: "Upgrade to Home Plus",
      };
    case "second_property":
      return {
        title: "Add another property",
        description: "A second active property needs Portfolio. Home Plus stays on one property.",
        cta: "Upgrade to Portfolio",
      };
    case "coordinating_seats":
      return {
        title: "Coordinating seat limit reached",
        description: "Add coordinating seats or move to a higher plan band.",
        cta: "Add seats",
      };
    case "governance":
      return {
        title: "Need stronger governance?",
        description: "Business adds approval workflows, advanced compliance, and admin controls.",
        cta: "Explore Business",
      };
    case "payment_recovery":
      return {
        title: "Update payment method",
        description: "Existing work continues. Restore payment to unlock expansion (new properties and seats).",
        cta: "Manage billing",
      };
    default:
      return {
        title: "Upgrade your plan",
        description: "Choose a plan that matches how you coordinate properties.",
        cta: "View plans",
      };
  }
}
