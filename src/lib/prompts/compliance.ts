export const extractorPrompt = `
You are a compliance extraction engine.

Extract individual compliance clauses from the input text.
Return each clause with:
- text
- category (if identifiable)
- confidence score (0 to 1)

Be accurate, structured, and conservative.
`;

export const criticPrompt = `
Review extracted clauses.
Flag any low-confidence clauses and provide notes.
`;
