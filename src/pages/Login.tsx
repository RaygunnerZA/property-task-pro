import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleMagicLink() {
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="p-6 text-center">
        <h1>Check your email</h1>
        <p>We've sent you a magic link to sign in.</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-4 max-w-sm mx-auto mt-20">
      <h1 className="text-xl font-semibold">Sign in</h1>

      <input
        type="email"
        placeholder="you@example.com"
        className="border rounded px-3 py-2"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {error && <p className="text-red-500">{error}</p>}

      <button onClick={handleMagicLink} className="px-4 py-2 bg-primary text-white rounded">
        Send Magic Link
      </button>
    </div>
  );
}
