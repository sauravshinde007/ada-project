export class TTSPreprocessor {
  /**
   * Preprocesses text from LLM to be safe and natural for TTS.
   */
  public process(text: string): string {
    let processed = text;
    
    // 1. Remove markdown formatting (bold, italics, code blocks, etc)
    processed = processed.replace(/[*_~`]/g, '');
    
    // 2. Remove emojis and unsupported symbols
    processed = processed.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    
    // 3. Normalize ALL-CAPS words (GPT-SoVITS G2P spells them out)
    // We match words that are ALL CAPS and > 1 letter long, and make them Capitalized
    processed = processed.replace(/\b([A-Z]{2,})\b/g, (match) => {
      // Keep acronyms if they are known (like AI, API, etc.), else capitalize
      const knownAcronyms = ['AI', 'API', 'LLM', 'TTS', 'VRM', 'OK', 'USA', 'UI', 'UX', 'HTML', 'CSS'];
      if (knownAcronyms.includes(match)) return match;
      return match.charAt(0) + match.slice(1).toLowerCase();
    });

    // 4. Normalize excessive punctuation
    processed = processed.replace(/!{2,}/g, '!');
    processed = processed.replace(/\?{2,}/g, '?');
    processed = processed.replace(/\.{4,}/g, '...');
    
    // 5. Clean up extra spaces
    processed = processed.replace(/\s+/g, ' ').trim();
    
    return processed;
  }
}
