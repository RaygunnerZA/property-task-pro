import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Create a context to track the current tab value
const TabsContext = React.createContext<{ value?: string }>({});

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <TabsContext.Provider value={{ value }}>
    <TabsPrimitive.Root
      ref={ref}
      className={cn(className)}
      value={value}
      {...props}
    />
  </TabsContext.Provider>
));
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

interface TabsContentsProps {
  children: React.ReactNode;
  transition?: {
    type?: "spring" | "tween" | "inertia";
    stiffness?: number;
    damping?: number;
    bounce?: number;
    restDelta?: number;
  };
  className?: string;
}

const TabsContents = React.forwardRef<HTMLDivElement, TabsContentsProps>(
  ({ children, transition, className, ...props }, ref) => {
    const { value: currentValue } = React.useContext(TabsContext);
    
    return (
      <div ref={ref} className={cn("relative", className)} {...props}>
        <AnimatePresence mode="wait">
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child) && child.props.value === currentValue) {
              return child;
            }
            return null;
          })}
        </AnimatePresence>
      </div>
    );
  }
);
TabsContents.displayName = "TabsContents";

interface TabsContentProps
  extends Omit<React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>, 'asChild'> {
  transition?: {
    type?: "spring" | "tween" | "inertia";
    stiffness?: number;
    damping?: number;
    bounce?: number;
    restDelta?: number;
  };
}

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  TabsContentProps
>(({ className, children, transition, value, ...props }, ref) => {
  const defaultTransition = {
    type: "spring" as const,
    stiffness: 300,
    damping: 32,
    bounce: 0,
    restDelta: 0.01,
    ...transition,
  };

  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      value={value}
      {...props}
    >
      <motion.div
        key={value}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        transition={defaultTransition}
        className="h-full"
      >
        {children}
      </motion.div>
    </TabsPrimitive.Content>
  );
});
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContents, TabsContent };
