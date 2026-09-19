import { TTSProvider, TTSRequest, TTSResult } from './TTSProvider.js';

export class GPTSoVITSProvider implements TTSProvider {
  private apiUrl: string;
  
  constructor(apiUrl: string = 'http://127.0.0.1:9880') {
    this.apiUrl = apiUrl;
  }

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const { text } = request;
    
    // Emotion and intensity are not yet mapped to specific reference audios in Phase 7A.
    // We use environment variables for the required reference audio parameters or fallback to placeholders.
    const refAudioPath = process.env.TTS_REF_AUDIO_PATH || "reference_audio.wav";
    const promptText = process.env.TTS_PROMPT_TEXT || "This is a reference text.";
    const promptLang = process.env.TTS_PROMPT_LANG || "en";
    
    const payload = {
      text: text,
      text_lang: "en",
      ref_audio_path: refAudioPath,
      prompt_text: promptText,
      prompt_lang: promptLang,
      media_type: "wav",
      streaming_mode: false,
      text_split_method: "cut1"
    };

    try {
      const response = await fetch(`${this.apiUrl}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GPT-SoVITS API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      return { audio: buffer };
    } catch (error) {
      console.error('[GPTSoVITSProvider] Error during synthesis:', error);
      throw error;
    }
  }
}
