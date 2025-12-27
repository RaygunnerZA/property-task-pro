import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NeomorphicInputProps extends React.ComponentProps<typeof Input> {
  // Extends all Input props
}

export const NeomorphicInput = forwardRef<HTMLInputElement, NeomorphicInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        className={cn("input-neomorphic", className)}
        {...props}
      />
    );
  }
);

NeomorphicInput.displayName = "NeomorphicInput";

