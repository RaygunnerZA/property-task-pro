import fillaAiIcon from "@/assets/filla-ai.svg";
import { cn } from "@/lib/utils";

/**
 * Filla speech-bubble mark (`filla-ai.svg`, viewBox 50×55).
 * Keep height-driven + intrinsic ratio — never force a square or it squashes vertically.
 */
export function FillaAiMark({
  className,
  size = 16,
}: {
  className?: string;
  /** Rendered height in px; width follows the 50∶55 artboard. */
  size?: number;
}) {
  const width = Math.round((size * 50) / 55);
  return (
    <img
      src={fillaAiIcon}
      alt=""
      aria-hidden
      className={cn("shrink-0 object-contain opacity-80", className)}
      width={50}
      height={55}
      style={{ height: size, width, aspectRatio: "50 / 55" }}
    />
  );
}
