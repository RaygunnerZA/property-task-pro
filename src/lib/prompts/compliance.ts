export const extractorPrompt = `
Extract compliance clauses from the following text.
Return clauses with category and confidence.
`;

export const criticPrompt = `
Review extracted clauses. Flag low-confidence issues and provide notes.
`;
