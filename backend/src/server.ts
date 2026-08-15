import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { WebSocketMessage, WebSocketResponse, ChatMessage } from '../../shared/src/types/index.js';
import { LlamaCppProvider } from './ai/providers/LlamaCppProvider.js';
import { LLMMessage } from './ai/providers/LLMProvider.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ada-backend'
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const llmProvider = new LlamaCppProvider();

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');

  const conversation: LLMMessage[] = [
    {
      role: 'system',
      content: 'You are Ada, a friendly personal AI companion.'
    }
  ];

  ws.on('message', async (message: string) => {
    try {
      const data: WebSocketMessage = JSON.parse(message.toString());
      
      if (data.type === 'chat_message') {
        const userMsg = data.payload;
        console.log('Received message:', userMsg.text);

        conversation.push({
          role: 'user',
          content: userMsg.text
        });

        try {
          const response = await llmProvider.generate({
            messages: conversation
          });

          conversation.push({
            role: 'assistant',
            content: response.content
          });

          const responseMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: 'ada',
            text: response.content,
            timestamp: Date.now(),
          };

          const wsResponse: WebSocketResponse = {
            type: 'chat_response',
            payload: responseMsg
          };

          ws.send(JSON.stringify(wsResponse));
        } catch (llmError) {
          console.error('LLM generation error:', llmError);
          
          const errorMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: 'ada',
            text: "I'm having trouble connecting to my brain right now. Please try again later.",
            timestamp: Date.now(),
          };

          ws.send(JSON.stringify({
            type: 'chat_response',
            payload: errorMsg
          }));
        }
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

server.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
