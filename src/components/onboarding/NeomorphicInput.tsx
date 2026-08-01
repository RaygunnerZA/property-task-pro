import { forwardRef, InputHTMLAttributes } from "react";

interface NeomorphicInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const NeomorphicInput = forwardRef<HTMLInputElement, NeomorphicInputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="mb-6">
        {label && (
          <label className="block text-sm font-medium text-muted-foreground mb-2 text-center">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-4 py-3 rounded-xl bg-input text-foreground shadow-engraved
            placeholder:text-muted-foreground/50
            transition-[box-shadow,background-color] duration-150 ease-out
            focus:outline-none focus:ring-2 focus:ring-primary/30
            ${error ? "ring-2 ring-destructive/50" : ""}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

NeomorphicInput.displayName = "NeomorphicInput";
