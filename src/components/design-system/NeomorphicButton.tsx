import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ButtonProps } from "@/components/ui/button";

interface NeomorphicButtonProps extends ButtonProps {
  // Extends all Button props
}

export const NeomorphicButton = forwardRef<HTMLButtonElement, NeomorphicButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn("btn-neomorphic", className)}
        {...props}
      />
    );
  }
);

NeomorphicButton.displayName = "NeomorphicButton";

