import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { complianceClauses } from "@/services/compliance/clauses";

interface UseClauseEditorProps {
  initialText?: string;
  clauseId?: string;
}

export function useClauseEditor({
  initialText = "",
  clauseId,
}: UseClauseEditorProps = {}) {
  const queryClient = useQueryClient();
  const [original, setOriginal] = useState(initialText);
  const [edited, setEdited] = useState(initialText);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setOriginal(initialText);
    setEdited(initialText);
  }, [initialText]);

  const save = async () => {
    if (!clauseId) {
      setOriginal(edited);
      return;
    }
    setLoading(true);
    try {
      const { error } = await complianceClauses.updateClauseText(
        clauseId,
        edited
      );
      if (error) throw new Error(error);
      setOriginal(edited);
      await queryClient.invalidateQueries({ queryKey: ["compliance-review"] });
    } catch (error) {
      console.error("Error saving clause:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const cancel = () => {
    setEdited(original);
  };

  return {
    original,
    edited,
    setEdited,
    save,
    cancel,
    loading,
    isDirty: original !== edited,
  };
}
