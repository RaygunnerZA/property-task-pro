/** Demo art shipped in the app, not a member's uploaded file. */
export function isSampleIllustrationUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  const path = url.split("?")[0] ?? "";
  return (
    path.includes("/spaces/mini-cards/") ||
    path.includes("/centre-workbench/") ||
    path.includes("/textures/")
  );
}
