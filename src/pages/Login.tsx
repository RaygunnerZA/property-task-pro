import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    window.location.href = "/";
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResetSuccess(false);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setResetSuccess(true);
  }

  return (
    <div className="p-6 max-w-sm mx-auto mt-20 flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{resetMode ? "Reset Password" : "Sign in"}</h1>

      {!resetMode ? (
        <form onSubmit={handleSignIn} className="flex flex-col gap-3">
          <input
            type="email"
            className="border rounded px-3 py-2"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            className="border rounded px-3 py-2"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div className="text-red-500 text-sm">{error}</div>}

          <button type="submit" className="px-4 py-2 bg-primary text-white rounded">
            Sign in
          </button>

          <button
            type="button"
            onClick={() => setResetMode(true)}
            className="text-sm text-primary underline"
          >
            Forgot password?
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
          <input
            type="email"
            className="border rounded px-3 py-2"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {error && <div className="text-red-500 text-sm">{error}</div>}
          {resetSuccess && (
            <div className="text-green-600 text-sm">
              Check your email for the password reset link
            </div>
          )}

          <button type="submit" className="px-4 py-2 bg-primary text-white rounded">
            Send Reset Link
          </button>

          <button
            type="button"
            onClick={() => {
              setResetMode(false);
              setResetSuccess(false);
              setError("");
            }}
            className="text-sm text-primary underline"
          >
            Back to sign in
          </button>
        </form>
      )}
    </div>
  );
}
