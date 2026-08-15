export const EMOTIONS = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'excited',
  'surprised',
  'curious',
  'confused',
  'embarrassed',
  'annoyed'
] as const;

export type Emotion = typeof EMOTIONS[number];

export interface StructuredLLMResponse {
  text: string;
  emotion: Emotion;
  intensity: number;
  animation: string;
}

export function validateStructuredResponse(data: any): data is StructuredLLMResponse {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.text !== 'string') return false;
  if (typeof data.emotion !== 'string' || !EMOTIONS.includes(data.emotion)) return false;
  if (typeof data.intensity !== 'number' || data.intensity < 0 || data.intensity > 1) return false;
  if (typeof data.animation !== 'string') return false;
  return true;
}
