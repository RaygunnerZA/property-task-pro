import { Link, useNavigate } from "react-router-dom";
import { Bell, LogOut, Settings, UserCircle } from "lucide-react";
import { useDataContext } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { userAvatarUrl, userDisplayName, userInitials } from "@/lib/userDisplayHelpers";
import { gradientHeaderControlClassName } from "@/lib/gradientHeaderControls";

type HeaderAccountMenuProps = {
  /** Sits on property / workbench gradient: light ring, readable on color. */
  variant?: "default" | "onGradient";
  accentColor?: string;
};

export function HeaderAccountMenu({
  variant = "default",
  accentColor = "#8EC9CE",
}: HeaderAccountMenuProps) {
  const navigate = useNavigate();
  const { user, organisation } = useDataContext();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const onGradient = variant === "onGradient";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex h-9 w-9 shrink-0 items-center justify-center outline-none transition-shadow",
            onGradient
              ? gradientHeaderControlClassName("overflow-hidden p-0.5")
              : "rounded-[12px] bg-card shadow-e1 hover:shadow-e2 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
          aria-label="Open account menu"
        >
          <Avatar className="h-full w-full rounded-[10px]">
            <AvatarImage src={userAvatarUrl(user)} alt="" className="object-cover" />
            <AvatarFallback
              className="rounded-[10px] text-xs font-semibold"
              style={{
                backgroundColor: onGradient ? `${accentColor}40` : "hsl(var(--primary) / 0.35)",
                color: onGradient ? accentColor : "hsl(var(--foreground))",
              }}
            >
              {userInitials(user)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(100vw-2rem,280px)] rounded-[10px] border-border/40 p-1 shadow-md"
      >
        <DropdownMenuLabel className="space-y-0.5 px-2 py-2 font-normal">
          <p className="truncate text-sm font-semibold text-foreground">{userDisplayName(user)}</p>
          {user?.email && (
            <p className="truncate text-xs text-muted-foreground" title={user.email}>
              {user.email}
            </p>
          )}
          {organisation?.name && (
            <p className="truncate text-[11px] text-muted-foreground/90 pt-0.5">{organisation.name}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer rounded-[6px]">
          <Link to="/settings/profile" className="flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-muted-foreground" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-[6px]">
          <Link to="/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-[6px]">
          <Link to="/settings/automation" className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            Notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer rounded-[6px] text-destructive focus:text-destructive"
          onSelect={(e) => {
            e.preventDefault();
            void handleSignOut();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
