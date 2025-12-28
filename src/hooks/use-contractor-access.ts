import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "./useActiveOrg";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook for generating contractor magic links
 * Creates a token in contractor_tokens table and returns the full URL
 */
export function useContractorAccess() {
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  /**
   * Generate a magic link for a task
   * @param taskId - The task ID to create a link for
   * @returns The full magic link URL
   */
  const generateMagicLink = async (taskId: string): Promise<string | null> => {
    if (!taskId) {
      toast({
        title: "Error",
        description: "Task ID is required",
        variant: "destructive",
      });
      return null;
    }

    if (!orgId) {
      toast({
        title: "Error",
        description: "Organization not found",
        variant: "destructive",
      });
      return null;
    }

    setLoading(true);

    try {
      // Generate a secure random token
      const token = crypto.randomUUID();

      // Insert token into contractor_tokens table
      const { data, error } = await supabase
        .from("contractor_tokens")
        .insert({
          task_id: taskId,
          token: token,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating contractor token:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to create magic link",
          variant: "destructive",
        });
        return null;
      }

      if (!data) {
        toast({
          title: "Error",
          description: "Failed to create magic link",
          variant: "destructive",
        });
        return null;
      }

      // Construct the full URL
      const baseUrl = window.location.origin;
      const magicLink = `${baseUrl}/contractor/access?token=${token}`;

      toast({
        title: "Magic link generated",
        description: "Link copied to clipboard",
      });

      // Copy to clipboard
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(magicLink);
      }

      return magicLink;
    } catch (err: any) {
      console.error("Error generating magic link:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to generate magic link",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    generateMagicLink,
    loading,
  };
}

