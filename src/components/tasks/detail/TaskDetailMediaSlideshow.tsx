import { cn } from "@/lib/utils";
import type { TaskDetailImageThumb } from "@/components/tasks/detail/TaskDetailHeroMeta";

type TaskDetailMediaSlideshowProps = {
  images: TaskDetailImageThumb[];
  onOpenImage?: (index: number) => void;
  className?: string;
};

/**
 * Left-pane evidence stack for the wide fullscreen task modal.
 * Multiple images scroll vertically with a gap between them.
 */
export function TaskDetailMediaSlideshow({
  images,
  onOpenImage,
  className,
}: TaskDetailMediaSlideshowProps) {
  if (images.length === 0) return null;

  return (
    <div
      className={cn(
        "relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-[#1a2c37]",
        className
      )}
    >
      <div className="flex min-h-full flex-col gap-3 p-3">
        {images.map((image, index) => {
          const src = image.heroSrc || image.src;
          return (
            <button
              key={image.id}
              type="button"
              onClick={() => onOpenImage?.(index)}
              aria-label={image.alt ? `Annotate ${image.alt}` : `Annotate image ${index + 1}`}
              className="block w-full shrink-0 overflow-hidden rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <img
                src={src}
                alt={image.alt || ""}
                className="h-auto w-full object-contain"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
