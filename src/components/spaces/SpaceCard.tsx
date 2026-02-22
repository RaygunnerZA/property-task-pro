import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAssetIcon } from "@/lib/icon-resolver";
import { supabase } from "@/integrations/supabase/client";
import { AIIconColorPicker } from "@/components/ui/AIIconColorPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SpaceCardProps {
  space: {
    id: string;
    name?: string | null;
    type?: string | null;
    property_id?: string | null;
    icon_name?: string | null;
    taskCount?: number;
    urgentTaskCount?: number;
  };
  /** Group color for mini card (from space group). Falls back to primary teal. */
  groupColor?: string;
  className?: string;
  onFilterClick?: (spaceId: string) => void;
}

export function SpaceCard({ space, groupColor, className, onFilterClick }: SpaceCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [iconDialogOpen, setIconDialogOpen] = useState(false);
  const [iconValue, setIconValue] = useState({ iconName: space.icon_name || "box", color: groupColor ?? "#8EC9CE" });
  
  const displayName = space.name || space.type || 'Unnamed Space';
  const taskCount = space.taskCount ?? 0;
  const urgentCount = space.urgentTaskCount ?? 0;
  
  const iconColor = groupColor ?? "#8EC9CE";

  const handleTopSectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (space.property_id && space.id) {
      navigate(`/properties/${space.property_id}/spaces/${space.id}`);
    } else if (space.property_id) {
      navigate(`/properties/${space.property_id}`);
    }
  };

  const handleMetaZoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFilterClick) {
      onFilterClick(space.id);
    }
  };

  return (
    <div
      className={cn(
        "bg-card/60 rounded-[8px] overflow-hidden shadow-e1 h-[155px]",
        "transition-all duration-200",
        className
      )}
    >
      {/* Thumbnail Image */}
      <div 
        className="w-full h-[63px] overflow-hidden relative"
        style={{
          backgroundColor: iconColor,
        }}
      >
        {/* Space Icon - positioned top left, clickable to change icon */}
        <button
          type="button"
          className="absolute top-2 left-2 rounded-[5px] flex items-center justify-center z-10 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
          style={{
            backgroundColor: iconColor,
            width: '24px',
            height: '24px',
            boxShadow: "2px 2px 4px rgba(0,0,0,0.1), -1px -1px 2px rgba(255,255,255,0.3)",
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6b0bc6'},body:JSON.stringify({sessionId:'6b0bc6',location:'SpaceCard.tsx:82',message:'Icon button clicked',data:{spaceId:space.id,spaceName:space.name,iconDialogOpenBefore:iconDialogOpen},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            setIconValue({ iconName: space.icon_name || "box", color: groupColor ?? "#8EC9CE" });
            setIconDialogOpen(true);
          }}
        >
          {(() => {
            const SpaceIcon = getAssetIcon(space.icon_name);
            return <SpaceIcon className="h-4 w-4 text-white" />;
          })()}
        </button>
        {/* Neumorphic overlay */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1), 3px 0px 6px rgba(0, 0, 0, 0.15)'
          }}
        />
      </div>
      
      <div className="pt-2.5 pb-2.5 pl-2.5 pr-2.5 space-y-2 h-[96px]">
        {/* Top Section - Clickable for navigation */}
        <div 
          onClick={handleTopSectionClick}
          style={{ verticalAlign: 'middle' }}
          className="cursor-pointer active:scale-[0.99] mb-[22px] mt-[4px] h-[15px] flex flex-col justify-center items-start"
        >
          <h3 className="font-semibold text-sm text-foreground leading-tight h-[16px]" style={{ verticalAlign: 'middle', lineHeight: '15px' }}>
            {displayName}
          </h3>
        </div>

        {/* Neumorphic Perforation Line - Row of cut circles */}
        <div 
          className="-ml-2.5 -mr-2.5 pt-0 pb-0 px-1"
          style={{
            height: '1px',
            backgroundImage: 'repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)',
            backgroundSize: '7px 1px',
            backgroundRepeat: 'repeat-x',
            boxShadow: '1px 1px 0px rgba(255, 255, 255, 1), -1px -1px 1px rgba(0, 0, 0, 0.075)',
          }}
        />

        {/* Meta Zone - Clickable for filtering */}
        <div 
          onClick={handleMetaZoneClick}
          className="cursor-pointer active:scale-[0.99] m-0"
        >
          {/* Task Counts Row */}
          <div className="flex items-center gap-2 flex-wrap mt-0 pt-[3px]">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />
              {taskCount} Task{taskCount !== 1 ? 's' : ''}
            </span>
            {urgentCount > 0 && (
              <span className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {urgentCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Change Icon Dialog */}
      <Dialog open={iconDialogOpen} onOpenChange={(open) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6b0bc6'},body:JSON.stringify({sessionId:'6b0bc6',location:'SpaceCard.tsx:dialog-onOpenChange',message:'Dialog onOpenChange called',data:{newOpen:open,spaceId:space.id},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setIconDialogOpen(open);
      }}>
        <DialogContent className="max-w-sm p-5" aria-describedby="space-icon-desc">
          <DialogHeader>
            <DialogTitle>Change Icon</DialogTitle>
            <DialogDescription id="space-icon-desc">
              Pick a new icon for <strong>{displayName}</strong>
            </DialogDescription>
          </DialogHeader>
          <AIIconColorPicker
            searchText={displayName}
            value={iconValue}
            onChange={(icon, color) => setIconValue({ iconName: icon, color })}
            suggestedIcon={space.icon_name}
            showSearchInput
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIconDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  const { error } = await supabase
                    .from("spaces")
                    .update({ icon_name: iconValue.iconName })
                    .eq("id", space.id);
                  if (error) throw error;
                  toast.success("Icon updated");
                  queryClient.invalidateQueries({ queryKey: ["spaces"] });
                  setIconDialogOpen(false);
                } catch (err: any) {
                  toast.error(err.message || "Failed to update icon");
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

