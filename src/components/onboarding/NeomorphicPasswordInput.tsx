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
          <label className="block text-sm font-medium text-[#6D7480] mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type={showPassword ? "text" : "password"}
            className={`
              w-full px-4 py-3 pr-12 rounded-xl bg-[#F6F4F2] text-[#1C1C1C]
              placeholder:text-[#6D7480]/50
              transition-all duration-150 ease-out
              focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30
              ${error ? "ring-2 ring-[#FF6B6B]/50" : ""}
              ${className}
            `}
            style={{
              boxShadow: error
                ? "inset 2px 2px 4px rgba(255,107,107,0.15), inset -2px -2px 4px rgba(255,255,255,0.7)"
                : "inset 2px 2px 4px rgba(0,0,0,0.08), inset -2px -2px 4px rgba(255,255,255,0.7)"
            }}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6D7480] hover:text-[#1C1C1C] transition-colors duration-150"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-[#FF6B6B]">{error}</p>
        )}
      </div>
    );
  }
);

NeomorphicPasswordInput.displayName = "NeomorphicPasswordInput";
