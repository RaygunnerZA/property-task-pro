/**
 * Who may see the Dev Tools UI.
 *
 * Local Vite (`import.meta.env.DEV`): any signed-in session (developer machine).
 * Deployed builds with `VITE_APP_DEV_BUILD=true`: allowlisted emails only.
 * Production (no DEV / no VITE_APP_DEV_BUILD): never.
 *
 * This is a UI gate only. Knowledge CMS and admin RPCs still require
 * `platform_admins` / `is_platform_admin()` server-side.
 */

/** Internal emails permitted to see Dev Tools on a deployed dev build. */
export const DEV_TOOLS_EMAIL_ALLOWLIST = [
  "justinplunkett@gmail.com",
  "studio@justinplunkett.com",
  "mattlegrange@me.com",
] as const;

const ALLOWLIST = new Set(
  DEV_TOOLS_EMAIL_ALLOWLIST.map((email) => email.toLowerCase())
);

function isDevToolsBuild(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_APP_DEV_BUILD === "true";
}

export function isDevToolsEmailAllowed(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  return ALLOWLIST.has(email.trim().toLowerCase());
}

/**
 * Whether the Dev Tools dropdown / overlays may render for this user.
 * Fail closed when build flag is off or email is missing on deployed builds.
 */
export function canAccessDevTools(email: string | null | undefined): boolean {
  if (!isDevToolsBuild()) return false;
  // Local Vite: developer machine — do not block test-persona switching.
  if (import.meta.env.DEV) return true;
  return isDevToolsEmailAllowed(email);
}
