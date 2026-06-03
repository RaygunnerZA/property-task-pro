import { cn } from "@/lib/utils";
import type { PropertyProfileOption } from "@/lib/propertyProfiles";

interface PropertyProfileCardProps {
  option: PropertyProfileOption;
  isActive: boolean;
  isConfirmed: boolean;
  onActivate: () => void;
}

export function PropertyProfileCard({
  option,
  isActive,
  isConfirmed,
  onActivate,
}: PropertyProfileCardProps) {
  return (
    <button
      type="button"
      onClick={() => {
        if (isActive) onActivate();
      }}
      tabIndex={isActive ? 0 : -1}
      className={cn(
        "flex w-full flex-col items-center gap-4 px-2 py-2 text-center transition-colors duration-200",
        "rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EC9CE]/50",
        isActive ? "cursor-pointer" : "pointer-events-none cursor-default"
      )}
      aria-pressed={isConfirmed}
      aria-label={`${option.label}. ${option.description}`}
    >
      <img
        src={option.iconSrc}
        alt=""
        draggable={false}
        className={cn(
          "pointer-events-none object-contain transition-transform duration-200 select-none",
          isActive ? "h-44 w-44 sm:h-48 sm:w-48" : "h-40 w-40 sm:h-44 sm:w-44 opacity-80"
        )}
        width={192}
        height={192}
        decoding="async"
      />
      <div className="max-w-[min(100%,16rem)] space-y-1">
        <p
          className={cn(
            "text-lg font-medium leading-tight transition-colors duration-200",
            isConfirmed
              ? "font-semibold text-[#1C1C1C]"
              : isActive
                ? "text-[#6D7480]"
                : "text-[#6D7480]/80"
          )}
        >
          {option.label}
        </p>
        <p className="text-sm leading-snug text-[#6D7480]">{option.description}</p>
      </div>
    </button>
  );
}
