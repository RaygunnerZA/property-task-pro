import { forwardRef, InputHTMLAttributes, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface NeomorphicPasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const NeomorphicPasswordInput = forwardRef<HTMLInputElement, NeomorphicPasswordInputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="mb-6">
        {label && (
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type={showPassword ? "text" : "password"}
            className={`
              w-full px-4 py-3 pr-12 rounded-xl bg-input text-foreground shadow-engraved
              placeholder:text-muted-foreground/50
              transition-[box-shadow,background-color] duration-150 ease-out
              focus:outline-none focus:ring-2 focus:ring-primary/30
              ${error ? "ring-2 ring-destructive/50" : ""}
              ${className}
            `}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

NeomorphicPasswordInput.displayName = "NeomorphicPasswordInput";
