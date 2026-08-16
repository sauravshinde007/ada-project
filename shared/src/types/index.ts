export interface ChatMessage {
  id: string;
  sender: 'user' | 'ada';
  text: string;
  timestamp: number;
  emotion?: string;
  intensity?: number;
  animation?: string;
  audioData?: string;
}

export interface WebSocketMessage {
  type: 'chat_message' | 'ping';
  payload?: any;
}

export interface WebSocketResponse {
  type: 'chat_response' | 'error' | 'pong';
  payload?: any;
}
