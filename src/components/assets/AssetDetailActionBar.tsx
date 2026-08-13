import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ChevronDown,
  ClipboardCheck,
  Copy,
  FileText,
  ListTodo,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { cn } from "@/lib/utils";

type AssetDetailActionBarProps = {
  isBusy?: boolean;
  isRetired?: boolean;
  onCreateTask: () => void;
  onAddRecord: () => void;
  onLogInspection: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onAskFilla?: () => void;
};

/** Collapse More → ••• when the action bar is narrower than this. */
const MORE_COMPACT_MAX_WIDTH = 420;

/**
 * Primary actions for Asset Detail.
 * Create Task + Add Record + More (Duplicate / Archive / Delete).
 */
export function AssetDetailActionBar({
  isBusy = false,
  isRetired = false,
  onCreateTask,
  onAddRecord,
  onLogInspection,
  onDuplicate,
  onArchive,
  onDelete,
  onAskFilla,
}: AssetDetailActionBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreCompact, setMoreCompact] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const sync = () => setMoreCompact(el.clientWidth < MORE_COMPACT_MAX_WIDTH);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={barRef} className="flex min-w-0 w-full flex-nowrap items-center gap-2">
      <Button
        type="button"
        className="h-9 min-w-0 flex-1 font-semibold shadow-primary-btn sm:flex-none sm:px-4"
        disabled={isBusy}
        onClick={onCreateTask}
      >
        <ListTodo className="h-4 w-4" aria-hidden />
        Create Task
      </Button>

      <Button
        type="button"
        className={cn(
          "h-9 min-w-0 flex-1 font-semibold text-white sm:flex-none sm:px-4",
          "bg-[hsl(16_82%_56%)] intake-cta-grain",
          "shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),inset_1px_1px_2px_0px_rgba(255,255,255,0.4)]",
          "hover:brightness-95"
        )}
        disabled={isBusy}
        onClick={onAddRecord}
      >
        <FileText className="h-4 w-4" aria-hidden />
        Add Record
      </Button>

      <DropdownMenu modal={false} open={moreOpen} onOpenChange={setMoreOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn("shrink-0 shadow-e1", moreCompact ? "h-9 w-9 px-0" : "gap-1 px-3")}
            aria-label="More"
            disabled={isBusy}
          >
            {moreCompact ? (
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            ) : (
              <>
                More
                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[120] min-w-[12rem]">
          <DropdownMenuItem onSelect={() => onLogInspection()}>
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Log inspection
          </DropdownMenuItem>
          {onAskFilla ? (
            <DropdownMenuItem onSelect={() => onAskFilla()}>
              <FillaIcon size={16} className="mr-2" />
              Ask Filla
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onDuplicate()} disabled={isBusy}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onArchive()} disabled={isBusy || isRetired}>
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => onDelete()}
            disabled={isBusy}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
