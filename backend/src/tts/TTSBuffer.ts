export class TTSBuffer {
  private buffer: string = '';

  public push(chunk: string): string[] {
    this.buffer += chunk;
    const emitted: string[] = [];

    while (true) {
      let match = null;
      // Look for . ! ? \n followed by a whitespace character.
      const regex = /([.!?\n]+)(?=\s)/g;
      let m;
      
      while ((m = regex.exec(this.buffer)) !== null) {
        const index = m.index;
        
        // Negative lookbehind for common abbreviations
        const preceding = this.buffer.substring(0, index);
        const lastWordMatch = preceding.match(/([a-zA-Z]+)$/);
        
        if (lastWordMatch) {
          const lastWord = lastWordMatch[1].toLowerCase();
          const abbreviations = ['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'vs', 'etc', 'ie', 'eg', 'st'];
          if (abbreviations.includes(lastWord)) {
            continue; // Skip this boundary, it's an abbreviation
          }
        }
        
        const textToEmit = this.buffer.substring(0, index + m[1].length);
        
        // Ensure the chunk isn't just a tiny fragment (e.g. just a period)
        if (textToEmit.trim().length > 1) {
            match = { index: index + m[1].length, text: textToEmit };
            break;
        }
      }

      if (match) {
        let chunk = match.text.trim();
        if (chunk) {
          emitted.push(chunk);
          if (process.env.DEBUG_TTS === 'true') {
            console.log(`[TTS Buffer] Emitting speech chunk: "${chunk}"`);
          }
        }
        this.buffer = this.buffer.substring(match.index);
      } else {
        break;
      }
    }

    return emitted;
  }

  public flush(): string | null {
    const chunk = this.buffer.trim();
    this.buffer = '';
    if (chunk) {
        if (process.env.DEBUG_TTS === 'true') {
            console.log(`[TTS Buffer] Flushing final chunk: "${chunk}"`);
        }
        return chunk;
    }
    return null;
  }
}
