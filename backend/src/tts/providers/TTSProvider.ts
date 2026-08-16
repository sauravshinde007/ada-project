export interface TTSRequest {
  text: string;
  emotion: string;
  intensity: number;
}

export interface TTSResult {
  audio: Buffer; // Audio buffer (wav format)
}

export interface TTSProvider {
  synthesize(request: TTSRequest): Promise<TTSResult>;
}
