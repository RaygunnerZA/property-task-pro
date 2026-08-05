import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  text: string;
  className?: string;
  /** Editable in workspace */
  editable?: boolean;
  onChange?: (value: string) => void;
};

export function ReportAiSummary({ text, className, editable, onChange }: Props) {
  return (
    <section
      className={cn(
        "rounded-xl bg-card/70 p-5 shadow-e1",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
        Property summary
      </div>
      {editable ? (
        <textarea
          value={text}
          onChange={(e) => onChange?.(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-lg bg-transparent text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70"
          placeholder="Write or refine the summary for this report…"
        />
      ) : (
        <p className="max-w-[62ch] text-base leading-relaxed text-foreground">
          {text}
        </p>
      )}
    </section>
  );
}
