import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get("access_token");

  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!accessToken) {
      setError("Invalid or missing recovery token.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) return setError(error.message);

    setDone(true);
    setTimeout(() => (window.location.href = "/login"), 1500);
  }

  return (
    <div className="max-w-sm mx-auto mt-20 p-4">
      <h1 className="text-xl font-semibold mb-4">Set a New Password</h1>

      {!done ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="New password"
            className="border p-2 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div className="text-red-500 text-sm">{error}</div>}

          <button className="bg-primary text-white p-2 rounded">
            Update Password
          </button>
        </form>
      ) : (
        <div className="text-green-600">Password updated. Redirecting…</div>
      )}
    </div>
  );
}
