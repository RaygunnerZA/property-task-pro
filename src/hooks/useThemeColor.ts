import { useEffect } from "react";

const DEFAULT_THEME_COLOR = "#8EC9CE";

/** Syncs Safari / mobile browser chrome with the active header accent colour. */
export function useThemeColor(color: string = DEFAULT_THEME_COLOR) {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    const previous = meta.content;
    meta.content = color;
    return () => {
      meta!.content = previous || DEFAULT_THEME_COLOR;
    };
  }, [color]);
}
