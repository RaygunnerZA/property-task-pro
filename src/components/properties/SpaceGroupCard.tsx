import { useNavigate } from "react-router-dom";
import { groupLabelToSlug } from "@/components/onboarding/onboardingSpaceGroups";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

interface SpaceGroupCardProps {
  groupName: string;
  description: string;
  thumbnailUrl?: string;
  color?: string;
  spaceCount?: number;
  propertyId: string;
  className?: string;
}

export function SpaceGroupCard({
  groupName,
  description,
  thumbnailUrl,
  color = "#8EC9CE",
  spaceCount = 0,
  propertyId,
  className,
}: SpaceGroupCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    const slug = groupLabelToSlug(groupName);
    navigate(`/properties/${propertyId}/spaces/organise/${slug}`);
  };

  return (
    <div
      className={cn(
        "bg-card rounded-[8px] overflow-hidden shadow-e1",
        "transition-all duration-200 cursor-pointer hover:shadow-md",
        "active:scale-[0.99] h-[260px]",
        className
      )}
      onClick={handleClick}
    >
      {/* Thumbnail Image */}
      <div 
        className="w-full h-[80px] overflow-hidden relative"
        style={{
          backgroundColor: thumbnailUrl ? undefined : color,
        }}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={groupName}
            className="w-full h-full object-cover"
          />
        ) : null}
        {/* Neumorphic overlay */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1), 3px 0px 6px rgba(0, 0, 0, 0.15)'
          }}
        />
      </div>
      
      <div className="pt-2 pb-2 pl-2.5 pr-2.5">
        {/* Title and Button Row */}
        <div className="flex items-center justify-between gap-1 h-[42px]">
          <h3 className="font-semibold text-lg text-foreground leading-tight flex-1">
            {groupName}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className="flex items-center justify-center rounded-[5px] transition-all duration-200 hover:bg-muted/30 flex-shrink-0"
            style={{
              width: '32px',
              height: '32px',
            }}
            aria-label={`View ${groupName} spaces`}
          >
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Neumorphic Perforation Line */}
        <div 
          className="-ml-2.5 -mr-2.5 pt-2 pb-0 px-1 mt-[7px]"
          style={{
            height: '1px',
            backgroundImage: 'repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)',
            backgroundSize: '7px 1px',
            backgroundRepeat: 'repeat-x',
            boxShadow: '1px 1px 0px rgba(255, 255, 255, 1), -1px -1px 1px rgba(0, 0, 0, 0.075)',
          }}
        />

        {/* Description */}
        <div className="space-y-1" style={{ marginTop: '3px' }}>
          <p className="text-xs text-muted-foreground leading-[18px]">
            {description}
          </p>
          {spaceCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {spaceCount} {spaceCount === 1 ? 'space' : 'spaces'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
