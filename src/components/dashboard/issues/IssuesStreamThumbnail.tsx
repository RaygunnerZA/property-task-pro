import { cn } from "@/lib/utils";
import { isTaskSpaceIllustrationUrl } from "@/lib/taskIllustration";

type IssuesStreamThumbnailProps = {
  url: string;
  alt: string;
  className?: string;
};

/** 60×60 stream row thumbnail — uploaded photo (cover) or space mini-card art (contain). */
export function IssuesStreamThumbnail({ url, alt, className }: IssuesStreamThumbnailProps) {
  const isIllustration = isTaskSpaceIllustrationUrl(url);

  return (
    <div
      className={cn(
        "flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-transparent shadow-none",
        className
      )}
    >
      <img
        src={url}
        alt={alt}
        className={cn(
          isIllustration
            ? "h-[55px] max-w-full object-contain p-1"
            : "h-full w-full object-cover"
        )}
      />
    </div>
  );
}
