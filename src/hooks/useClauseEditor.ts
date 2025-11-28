import { useState, useEffect } from 'react';

interface UseClauseEditorProps {
  initialText?: string;
  clauseId?: string;
}

export function useClauseEditor({ initialText = '', clauseId }: UseClauseEditorProps = {}) {
  const [original, setOriginal] = useState(initialText);
  const [edited, setEdited] = useState(initialText);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setOriginal(initialText);
    setEdited(initialText);
  }, [initialText]);

  const save = async () => {
    setLoading(true);
    try {
      // TODO: Connect to backend service to save edited clause
      console.log('Saving edited clause:', { clauseId, edited });
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setOriginal(edited);
    } catch (error) {
      console.error('Error saving clause:', error);
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
    isDirty: original !== edited
  };
}
