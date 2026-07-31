/**
 * Canonical browser CORS for Edge Functions.
 * Keep Allow-Headers in sync with @supabase/supabase-js client requests (v2.95+).
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "x-supabase-client-platform",
    "x-supabase-client-platform-version",
    "x-supabase-client-runtime",
    "x-supabase-client-runtime-version",
  ].join(", "),
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

/** Preflight response — must include Allow-Methods for browser invokes. */
export function corsPreflightResponse(): Response {
  return new Response("ok", { status: 200, headers: corsHeaders });
}
