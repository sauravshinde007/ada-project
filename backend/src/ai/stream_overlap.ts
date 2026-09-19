export function extractSentences(text: string): string[] {
  const matches = text.match(/[^.?!]+[.?!]+/g);
  return matches ? matches.map(m => m.trim()).filter(m => m.length > 0) : [];
}
