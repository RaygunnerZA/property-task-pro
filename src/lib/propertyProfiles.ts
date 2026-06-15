import homeIcon from "@/assets/onboarding/property-type-home.png";
import holidayHomeIcon from "@/assets/onboarding/property-type-holiday-home.png";
import rentalPropertyIcon from "@/assets/onboarding/property-type-rental-property.png";
import commercialBuildingIcon from "@/assets/onboarding/property-type-commercial-building.png";
import portfolioIcon from "@/assets/onboarding/property-type-multiple-properties.png";

export type PropertyProfileId =
  | "home"
  | "holiday_home"
  | "rental_property"
  | "commercial_building"
  | "portfolio";

export interface PropertyProfileOption {
  id: PropertyProfileId;
  label: string;
  description: string;
  iconSrc: string;
}

export const PROPERTY_PROFILE_OPTIONS: PropertyProfileOption[] = [
  {
    id: "home",
    label: "Home",
    description: "A house, apartment or primary residence",
    iconSrc: homeIcon,
  },
  {
    id: "holiday_home",
    label: "Holiday Home",
    description: "A second home or short-term rental",
    iconSrc: holidayHomeIcon,
  },
  {
    id: "rental_property",
    label: "Rental Property",
    description: "One or more residential lets",
    iconSrc: rentalPropertyIcon,
  },
  {
    id: "commercial_building",
    label: "Commercial Building",
    description: "Offices, retail, hospitality or mixed-use",
    iconSrc: commercialBuildingIcon,
  },
  {
    id: "portfolio",
    label: "Portfolio",
    description: "Multiple homes, buildings or sites",
    iconSrc: portfolioIcon,
  },
];

const PROFILE_IDS = new Set(PROPERTY_PROFILE_OPTIONS.map((o) => o.id));

export function isPropertyProfileId(value: unknown): value is PropertyProfileId {
  return typeof value === "string" && PROFILE_IDS.has(value as PropertyProfileId);
}

/** Primary homeowners manage solo — skip invite step in onboarding. */
export function shouldShowInviteTeamStep(profile: PropertyProfileId | null): boolean {
  return profile !== "home";
}

/** Next route after add-spaces: invite step, or null to finish onboarding at home. */
export function getPostAddSpacesRoute(profile: PropertyProfileId | null): string | null {
  return shouldShowInviteTeamStep(profile) ? "/onboarding/invite-team" : null;
}

export function getInviteTeamStepCopy(profile: PropertyProfileId | null): {
  title: string;
  subtitle: string;
} {
  if (profile === "holiday_home") {
    return {
      title: "Invite a helper",
      subtitle: "Share with a partner, cleaner, or caretaker",
    };
  }

  return {
    title: "Invite your team",
    subtitle: "Collaborate with colleagues",
  };
}

/** Maps onboarding property profile to organisation org_type at creation time. */
export function orgTypeForPropertyProfile(
  profile: PropertyProfileId
): "personal" | "business" {
  return profile === "home" || profile === "holiday_home" ? "personal" : "business";
}
