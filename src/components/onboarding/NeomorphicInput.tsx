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
          <label className="block text-sm font-medium text-[#6D7480] mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-4 py-3 rounded-xl bg-[#F6F4F2] text-[#1C1C1C]
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
        {error && (
          <p className="mt-2 text-sm text-[#FF6B6B]">{error}</p>
        )}
      </div>
    );
  }
);

NeomorphicInput.displayName = "NeomorphicInput";
