import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  active?: boolean;
}

interface OnboardingBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function OnboardingBreadcrumbs({ items }: OnboardingBreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-[#6D7480] mb-4">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className={item.active ? "text-[#1C1C1C] font-medium" : ""}>
            {item.label}
          </span>
          {index < items.length - 1 && (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      ))}
    </div>
  );
}

