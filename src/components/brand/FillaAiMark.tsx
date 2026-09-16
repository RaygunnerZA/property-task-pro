import fillaIcon from "@/assets/filla.svg";
import { cn } from "@/lib/utils";

/**
 * Filla speech-bubble mark — same solid mark as the left nav (`filla.svg`, viewBox 21×28).
 * Keep height-driven + intrinsic ratio — never force a square or it squashes vertically.
 */
export function FillaAiMark({
  className,
  size = 16,
}: {
  className?: string;
  /** Rendered height in px; width follows the 21∶28 artboard. */
  size?: number;
}) {
  const width = Math.round((size * 21) / 28);
  return (
    <img
      src={fillaIcon}
      alt=""
      aria-hidden
      className={cn("shrink-0 object-contain opacity-80", className)}
      width={21}
      height={28}
      style={{
        height: size,
        width,
        aspectRatio: "21 / 28",
        // Reserve 4px under the tail inside the fixed outer height (search bar stays same size).
        boxSizing: "border-box",
        paddingBottom: 4,
        objectPosition: "center top",
      }}
    />
  );
}
