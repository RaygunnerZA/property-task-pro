import { FileText, ImageIcon, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IntakePreviewKind } from "@/lib/intakeFileKind";

interface IntakeFileThumbProps {
  kind: IntakePreviewKind;
  thumbnailUrl: string | null;
  label: string;
  size?: "sm" | "md";
  isEmail?: boolean;
  className?: string;
}

const SIZE = {
  sm: { box: "h-9 w-9", img: 36, icon: "h-4 w-4" },
  md: { box: "h-16 w-16", img: 64, icon: "h-6 w-6" },
} as const;

export function IntakeFileThumb({
  kind,
  thumbnailUrl,
  label,
  size = "sm",
  isEmail = false,
  className,
}: IntakeFileThumbProps) {
  const dim = SIZE[size];
  const Icon = isEmail ? Mail : kind === "image" ? ImageIcon : FileText;

  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt=""
        width={dim.img}
        height={dim.img}
        className={cn(dim.box, "shrink-0 rounded-card object-cover shadow-e1 bg-muted/40", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        dim.box,
        "flex shrink-0 items-center justify-center rounded-card bg-muted/40 shadow-e1",
        className
      )}
      aria-hidden
    >
      <Icon className={cn(dim.icon, "text-muted-foreground")} />
      <span className="sr-only">{label}</span>
    </div>
  );
}
