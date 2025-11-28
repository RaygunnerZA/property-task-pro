export function useSaveClauseDecision() {
  const saveDecision = (clauseId: string, decision: 'approved' | 'rejected') => {
    // Placeholder: will call backend to save decision
    console.log('Save decision:', clauseId, decision);
  };

  return { saveDecision };
}
