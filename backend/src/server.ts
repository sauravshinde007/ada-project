import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { WebSocketMessage, WebSocketResponse, ChatMessage } from '../../shared/src/types/index.js';
import { LlamaCppProvider } from './ai/providers/LlamaCppProvider.js';
import { LLMMessage } from './ai/providers/LLMProvider.js';
import { ADA_SYSTEM_PROMPT } from './ai/prompts/SystemPrompt.js';
import { validateStructuredResponse } from '../../shared/src/schemas/emotion.js';

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
      content: ADA_SYSTEM_PROMPT
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

          let parsedResponse;
          try {
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : response.content;
            parsedResponse = JSON.parse(jsonString);
          } catch (e) {
            console.error('Failed to parse LLM response as JSON:', response.content);
            parsedResponse = {
              text: response.content,
              emotion: 'neutral',
              intensity: 0.0,
              animation: 'neutral'
            };
          }

          if (!validateStructuredResponse(parsedResponse)) {
             console.warn('Invalid structured response, using fallback format');
             if (typeof parsedResponse.text !== 'string') {
                parsedResponse.text = response.content;
             }
             parsedResponse.emotion = 'neutral';
             parsedResponse.intensity = 0.0;
             parsedResponse.animation = 'neutral';
          }

          conversation.push({
            role: 'assistant',
            content: JSON.stringify(parsedResponse)
          });

          const responseMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: 'ada',
            text: parsedResponse.text,
            timestamp: Date.now(),
            emotion: parsedResponse.emotion,
            intensity: parsedResponse.intensity,
            animation: parsedResponse.animation
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
