import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  formatSocialAuthError,
  signInWithSocialProvider,
  type SocialAuthProvider,
} from "@/lib/auth/oauth";
import { SocialProviderIcon } from "@/components/auth/SocialAuthIcons";

const PROVIDERS: { id: SocialAuthProvider; label: string }[] = [
  { id: "apple", label: "Continue with Apple" },
  { id: "google", label: "Continue with Google" },
  { id: "facebook", label: "Continue with Facebook" },
];

const SECONDARY_SHADOW = `-2px -2px 4px rgba(255,255,255,0.55), 2px 2px 4px rgba(0,0,0,0.1)`;

interface SocialAuthButtonsProps {
  className?: string;
  disabled?: boolean;
}

export function AuthMethodDivider({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="h-px flex-1 bg-[#D1CCC4]/80"
        aria-hidden
      />
      <span className="text-sm text-[#6D7480]">or</span>
      <div
        className="h-px flex-1 bg-[#D1CCC4]/80"
        aria-hidden
      />
    </div>
  );
}

export function SocialAuthButtons({ className, disabled }: SocialAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<SocialAuthProvider | null>(
    null
  );

  const handleProvider = async (provider: SocialAuthProvider) => {
    setLoadingProvider(provider);
    try {
      await signInWithSocialProvider(provider);
      // Browser redirects to provider; no further UI updates expected.
    } catch (err: unknown) {
      const { title, description } = formatSocialAuthError(err, provider);
      toast.error(title, { description });
      setLoadingProvider(null);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {PROVIDERS.map(({ id, label }) => {
        const isLoading = loadingProvider === id;
        const isDisabled = disabled || (loadingProvider != null && !isLoading);

        return (
          <button
            key={id}
            type="button"
            disabled={isDisabled}
            onClick={() => handleProvider(id)}
            className={cn(
              "flex w-full items-center justify-center gap-3 rounded-[5px] px-6 py-3",
              "text-sm font-medium text-[#1C1C1C] transition-all duration-150 ease-out",
              "hover:text-[#1C1C1C] disabled:cursor-not-allowed disabled:opacity-50"
            )}
            style={{ boxShadow: SECONDARY_SHADOW }}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#6D7480]" />
            ) : (
              <SocialProviderIcon provider={id} className="h-5 w-5 shrink-0" />
            )}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
