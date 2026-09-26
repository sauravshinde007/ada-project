import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage, WebSocketMessage, WebSocketResponse } from '../../../shared/src/types/index';
import { VRMAvatar } from '../avatar';
import { Subtitles } from './Subtitles';
import './App.css';

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');

  const [isTalking, setIsTalking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [subtitleProgress, setSubtitleProgress] = useState(0);
  const ws = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Connect to backend
    ws.current = new WebSocket('ws://localhost:3001');

    ws.current.onopen = () => {
      console.log('Connected to backend WebSocket');
    };

    ws.current.onmessage = (event) => {
      try {
        const response: WebSocketResponse = JSON.parse(event.data);
        if (response.type === 'chat_response' && response.payload) {
          setMessages((prev) => [...prev, response.payload]);
          if (!response.payload.audioData) {
             setIsThinking(false);
          }
        }
      } catch (e) {
        console.error('Failed to parse websocket message', e);
      }
    };

    ws.current.onclose = () => {
      console.log('Disconnected from backend WebSocket');
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !ws.current) return;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMsg]);

    const wsMsg: WebSocketMessage = {
      type: 'chat_message',
      payload: newMsg,
    };
    ws.current.send(JSON.stringify(wsMsg));

    setInputValue('');
    setIsThinking(true);
  };

  const latestAdaMessage = useMemo(() => {
    return [...messages].reverse().find(m => m.sender === 'ada');
  }, [messages]);

  return (
    <div className="main-container">
      <div className="avatar-section-fullscreen">
        <VRMAvatar 
          modelUrl="/models/ada-vrm-1.0.vrm" 
          emotion={latestAdaMessage?.emotion}
          intensity={latestAdaMessage?.intensity}
          animation={latestAdaMessage?.animation}
          isTalking={isTalking}
          isThinking={isThinking}
        />
      </div>

      {isTalking && latestAdaMessage && (
        <Subtitles text={latestAdaMessage.text} progress={subtitleProgress} />
      )}

      <div className="bottom-input-container">
        <form className="glass-input-form" onSubmit={handleSend}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="glass-input"
          />
        </form>
      </div>

      {/* Hidden audio tags for Ada's voice output */}
      <div style={{ display: 'none' }}>
        {messages.filter(m => m.sender === 'ada' && m.audioData).map((msg) => (
          <audio 
            key={msg.id}
            autoPlay 
            src={`data:audio/wav;base64,${msg.audioData}`} 
            onPlay={() => { 
              ws.current?.send(JSON.stringify({ type: 'latency_log', payload: { event: 'playback_start', ts: Date.now(), msgId: msg.id } }));
              setIsTalking(true); setIsThinking(false); setSubtitleProgress(0); 
            }}
            onTimeUpdate={(e) => {
              if (e.currentTarget.duration) {
                setSubtitleProgress(e.currentTarget.currentTime / e.currentTarget.duration);
              }
            }}
            onEnded={() => { setIsTalking(false); setSubtitleProgress(1); }}
            onError={() => { setIsTalking(false); setIsThinking(false); }}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
