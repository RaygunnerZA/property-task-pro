import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/EmptyState";

/**
 * Contractor Access Page
 * 
 * Validates contractor tokens from URL and redirects to task view
 * - Reads ?token= from URL
 * - Validates token exists in contractor_tokens table
 * - Stores token in localStorage
 * - Redirects to /contractor/task/:taskId
 */
export default function ContractorAccess() {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContractorAccess.tsx:16',message:'ContractorAccess component rendering',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setError("No token provided");
        setLoading(false);
        return;
      }

      try {
        // Fetch the token row to validate it exists and get the task_id
        const { data, error: fetchError } = await supabase
          .from("contractor_tokens")
          .select("task_id, token, created_at")
          .eq("token", token)
          .single();

        if (fetchError || !data) {
          setError("Invalid or expired token");
          setLoading(false);
          return;
        }

        // Store token in localStorage for use in the task view
        localStorage.setItem("contractor_token", token);
        localStorage.setItem("contractor_task_id", data.task_id);

        // Redirect to the task view
        navigate(`/contractor/task/${data.task_id}`);
      } catch (err: any) {
        console.error("Error validating token:", err);
        setError(err.message || "Failed to validate token");
        setLoading(false);
      }
    };

    validateToken();
  }, [searchParams, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Validating access token..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <EmptyState
          title="Access Denied"
          subtitle={error}
        />
      </div>
    );
  }

  return null;
}

