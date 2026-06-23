import { cn } from "@/lib/utils";

type GradientHeaderMaskedIconProps = {
  src: string;
  color: string;
  className?: string;
};

/** Tint a monochrome SVG asset with the active property colour. */
export function GradientHeaderMaskedIcon({ src, color, className }: GradientHeaderMaskedIconProps) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-5 w-5 shrink-0", className)}
      style={{
        backgroundColor: color,
        maskImage: `url(${src})`,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
        WebkitMaskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
      }}
    />
  );
}
