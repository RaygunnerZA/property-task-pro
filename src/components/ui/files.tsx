import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronRight, FileIcon, FolderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const Files = AccordionPrimitive.Root;

const FolderItem = AccordionPrimitive.Item;

const FolderTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & {
    gitStatus?: "untracked" | "modified" | "deleted";
  }
>(({ className, children, gitStatus, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex items-center gap-2 py-1.5 px-2 text-sm font-medium transition-all hover:bg-accent/50 rounded-md group [&[data-state=open]>svg:last-child]:rotate-90",
        className
      )}
      {...props}
    >
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      <FolderIcon className="h-4 w-4 shrink-0 text-amber-600" />
      {children}
      {gitStatus && (
        <span
          className={cn(
            "ml-auto h-2 w-2 rounded-full",
            gitStatus === "untracked" && "bg-blue-500",
            gitStatus === "modified" && "bg-yellow-500",
            gitStatus === "deleted" && "bg-red-500"
          )}
        />
      )}
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
FolderTrigger.displayName = "FolderTrigger";

const FolderContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pl-6 pt-1 pb-2 space-y-0.5", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
FolderContent.displayName = "FolderContent";

const SubFiles = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("space-y-0.5", className)}>{children}</div>
);

const FileItem = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    icon?: React.ElementType;
    gitStatus?: "untracked" | "modified" | "deleted";
  }
>(({ className, children, icon: Icon = FileIcon, gitStatus, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "flex items-center gap-2 py-1.5 px-2 text-sm text-muted-foreground hover:bg-accent/50 rounded-md cursor-pointer transition-colors group",
      className
    )}
    {...props}
  >
    <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
    {children}
    {gitStatus && (
      <span
        className={cn(
          "ml-auto h-2 w-2 rounded-full",
          gitStatus === "untracked" && "bg-blue-500",
          gitStatus === "modified" && "bg-yellow-500",
          gitStatus === "deleted" && "bg-red-500"
        )}
      />
    )}
  </span>
));
FileItem.displayName = "FileItem";

export { Files, FolderItem, FolderTrigger, FolderContent, SubFiles, FileItem };
