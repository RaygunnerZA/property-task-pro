import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) setMessage(error.message);
    else setMessage("Check your email for the magic link!");
    setLoading(false);
  }

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-3xl mb-6 font-bold">Sign In</h1>

      <form onSubmit={handleLogin} className="grid gap-4">
        <input
          className="border p-3 rounded"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <button
          disabled={loading}
          className="bg-black text-white p-3 rounded hover:bg-gray-800"
        >
          {loading ? "Sending..." : "Send magic link"}
        </button>

        {message && <p className="mt-3 text-red-600">{message}</p>}
      </form>
    </div>
  );
}
