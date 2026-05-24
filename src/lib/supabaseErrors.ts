/** PostgREST / Postgres errors when a relation is missing from the API schema cache. */
export function isMissingRelationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  const msg = String(e.message ?? "").toLowerCase();
  return (
    e.code === "PGRST205" ||
    e.code === "42P01" ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist") ||
    msg.includes("relation")
  );
}
