import { TTSProvider } from './providers/TTSProvider.js';
import { GPTSoVITSProvider } from './providers/GPTSoVITSProvider.js';
import { TTSPreprocessor } from './TTSPreprocessor.js';

export class TTSService {
  private provider: TTSProvider;
  private preprocessor: TTSPreprocessor;

  constructor() {
    // Inject the specific provider here. This could be configurable.
    this.provider = new GPTSoVITSProvider();
    this.preprocessor = new TTSPreprocessor();
  }

  public async generateAudio(text: string, emotion: string = 'neutral', intensity: number = 0.5): Promise<string | null> {
    try {
      const processedText = this.preprocessor.process(text);
      
      if (!processedText || processedText.length === 0) {
        console.log('[TTSService] Text was empty after preprocessing. Skipping synthesis.');
        return null;
      }

      console.log(`[TTSService] Synthesizing audio for text: "${processedText}"`);
      const result = await this.provider.synthesize({
        text: processedText,
        emotion,
        intensity
      });

      // Convert buffer to base64 for easy transport over WebSocket
      return result.audio.toString('base64');
    } catch (error) {
      console.error('[TTSService] Audio generation failed:', error);
      // We don't throw, we return null so the chat can continue without audio.
      return null;
    }
  }
}
