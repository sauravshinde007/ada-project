import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage, WebSocketMessage, WebSocketResponse } from '../../../shared/src/types/index';
import { VRMAvatar } from '../avatar';
import './App.css';

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
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
  };

  const latestAdaMessage = useMemo(() => {
    return [...messages].reverse().find(m => m.sender === 'ada');
  }, [messages]);

  return (
    <div className="main-container">
      <div className="avatar-section">
        <VRMAvatar 
          modelUrl="/models/ada-vrm-1.0.vrm" 
          emotion={latestAdaMessage?.emotion}
          intensity={latestAdaMessage?.intensity}
          animation={latestAdaMessage?.animation}
        />
      </div>
      
      <div className={`chat-section ${isChatOpen ? 'open' : 'closed'}`}>
        <div className="chat-toggle-handle" onClick={() => setIsChatOpen(!isChatOpen)}>
          <span>{isChatOpen ? '▶' : '◀'} Chat</span>
        </div>
        <div className="chat-content-wrapper">
          <header className="chat-header">
            <h2>Ada</h2>
            <div className="status-indicator">
              <span className={`status-dot ${ws.current?.readyState === WebSocket.OPEN ? 'online' : 'offline'}`}></span>
              {ws.current?.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected'}
            </div>
          </header>

          <div className="chat-messages">
          {messages.length === 0 && (
            <div className="empty-state">
              <p>No messages yet. Say hello to Ada!</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`message-wrapper ${msg.sender}`}>
              <div className={`message-bubble ${msg.sender}`}>
                <span className="sender-name">{msg.sender === 'user' ? 'You' : 'Ada'}</span>
                <p>{msg.text}</p>
                <span className="timestamp">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
          </div>

          <form className="chat-input-form" onSubmit={handleSend}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              className="chat-input"
            />
            <button type="submit" className="send-button" disabled={!inputValue.trim()}>
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
