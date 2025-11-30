import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get("access_token");

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!accessToken) {
      setError("Invalid or missing reset token.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
  }

  return (
    <div className="p-6 max-w-sm mx-auto mt-20 flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Reset your password</h1>

      {!success ? (
        <form onSubmit={handleReset} className="flex flex-col gap-3">
          <input
            type="password"
            className="border rounded px-3 py-2"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div className="text-red-500 text-sm">{error}</div>}

          <button type="submit" className="px-4 py-2 bg-primary text-white rounded">
            Update password
          </button>
        </form>
      ) : (
        <div className="text-green-600 text-sm">
          Password updated. Redirecting…
        </div>
      )}
    </div>
  );
}
