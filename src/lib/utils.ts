import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Canonical app URL for auth redirects. In production (Vercel), set VITE_APP_URL
 * so confirmation and recovery emails redirect to the deployed app, not localhost.
 */
export function getAppBaseUrl(): string {
  const env = import.meta.env.VITE_APP_URL;
  if (env && typeof env === "string") return env.replace(/\/$/, "");
  return window.location.origin;
}
