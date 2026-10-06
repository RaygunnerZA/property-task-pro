/** Keep the selected tab or chip inside a horizontal scroller. */
export function scrollActiveChipIntoView(root: ParentNode | null) {
  if (!root || !("querySelector" in root)) return;
  const selected = root.querySelector<HTMLElement>(
    '[role="tab"][aria-selected="true"], [role="tab"][data-state="active"]'
  );
  selected?.scrollIntoView({ inline: "nearest", block: "nearest" });
}
