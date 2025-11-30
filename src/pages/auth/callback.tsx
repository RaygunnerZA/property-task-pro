import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      navigate("/");
    });

    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  return <div className="p-6">Signing you in…</div>;
}
