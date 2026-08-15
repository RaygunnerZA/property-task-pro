import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      shadow: [
        "shadow-none",
        "shadow-e1",
        "shadow-e2",
        "shadow-e3",
        "shadow-inset",
        "shadow-engraved",
        "shadow-paper-edge",
        "shadow-primary-btn",
        "shadow-btn-pressed",
        "shadow-fab",
        "shadow-fab-neo",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Canonical app URL for auth redirects. In production (Vercel), set VITE_APP_URL
 * so confirmation and recovery emails redirect to the deployed app, not localhost.
 * Production should be the product origin only (https://app.filla.app) — never the marketing host.
 */
export function getAppBaseUrl(): string {
  const env = import.meta.env.VITE_APP_URL;
  if (env && typeof env === "string") return env.replace(/\/$/, "");
  return window.location.origin;
}

/**
 * Public marketing origin (www.filla.app). Used for “what Filla is” links from the app.
 * Never use this for auth redirects.
 */
export function getMarketingBaseUrl(): string {
  const env = import.meta.env.VITE_MARKETING_URL;
  if (env && typeof env === "string") return env.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:4321";
  return "https://www.filla.app";
}
