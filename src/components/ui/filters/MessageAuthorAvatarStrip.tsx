import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/tasks/UserAvatar";

export type MessageAuthorFilterOption = {
  authorKey: string;
  authorName: string;
  authorAvatarUrl: string | null;
  accentColor: string;
};

type MessageAuthorAvatarStripProps = {
  authors: MessageAuthorFilterOption[];
  selectedAuthorKey: string | null;
  onSelectAuthor: (authorKey: string | null) => void;
  className?: string;
};

/**
 * Replaces status chips on the Messages tab filter bar with unique recent-message authors.
 * Matches StatusFilterIconStrip footprint (24×24) so FILTER / SORT spacing stays stable.
 */
export function MessageAuthorAvatarStrip({
  authors,
  selectedAuthorKey,
  onSelectAuthor,
  className,
}: MessageAuthorAvatarStripProps) {
  if (authors.length === 0) {
    return (
      <span
        className={cn(
          "inline-flex h-6 items-center px-1 text-2xs text-muted-foreground/60",
          className
        )}
      >
        No senders
      </span>
    );
  }

  return (
    <div
      className={cn("inline-flex shrink-0 items-center gap-[6px]", className)}
      role="group"
      aria-label="Filter by recent message author"
      data-messages-author-strip
    >
      {authors.map((author) => {
        const selected = selectedAuthorKey === author.authorKey;
        return (
          <button
            key={author.authorKey}
            type="button"
            title={author.authorName}
            aria-label={author.authorName}
            aria-pressed={selected}
            onClick={() =>
              onSelectAuthor(selected ? null : author.authorKey)
            }
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full",
              "select-none cursor-pointer transition-[box-shadow,opacity,transform] duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              selected
                ? "opacity-100 ring-2 ring-primary/70 scale-105"
                : "opacity-80 hover:opacity-100 shadow-[1px_2px_2px_0px_rgba(0,0,0,0.12),-1px_-1px_2px_0px_rgba(255,255,255,0.85)]"
            )}
          >
            <UserAvatar
              imageUrl={author.authorAvatarUrl}
              name={author.authorName}
              propertyColor={author.accentColor}
              size={24}
              shape="circle"
            />
          </button>
        );
      })}
    </div>
  );
}
