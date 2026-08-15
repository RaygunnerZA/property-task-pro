/**
 * Authenticated product origin. Marketing never hosts login, signup, or sessions.
 * Production default: https://app.filla.app
 */
export function getAppOrigin(): string {
  const env = import.meta.env.VITE_APP_ORIGIN;
  if (env && typeof env === "string") return env.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:8080";
  return "https://app.filla.app";
}

export function appUrl(path: string): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${getAppOrigin()}${normalised}`;
}
