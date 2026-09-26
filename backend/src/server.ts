import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { WebSocketMessage, WebSocketResponse, ChatMessage } from '../../shared/src/types/index.js';
import { LlamaCppProvider } from './ai/providers/LlamaCppProvider.js';
import { GroqProvider } from './ai/providers/GroqProvider.js';
import { SearXNGProvider } from './ai/providers/SearXNGProvider.js';
import { HybridLLMRouter } from './ai/providers/HybridLLMRouter.js';
import { LLMMessage, LLMRequest } from './ai/providers/LLMProvider.js';
import { SkillRegistry } from './ai/skills/SkillRegistry.js';
import { WebSearchSkill } from './ai/skills/WebSearchSkill.js';
import { LLMPlanner } from './ai/planner/LLMPlanner.js';
import { ADA_SYSTEM_PROMPT } from './ai/prompts/SystemPrompt.js';
import { validateStructuredResponse } from '../../shared/src/schemas/emotion.js';
import { MemoryService } from './memory/MemoryService.js';
import { MemoryManager } from './memory/MemoryManager.js';
import { TTSService } from './tts/TTSService.js';
import { TTSBuffer } from './tts/TTSBuffer.js';

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

const localLlmProvider = new LlamaCppProvider();
const groqProvider = new GroqProvider();
const searxngProvider = new SearXNGProvider();

const skillRegistry = new SkillRegistry();
const webSearchSkill = new WebSearchSkill(searxngProvider);
skillRegistry.registerSkill(webSearchSkill);

const planner = new LLMPlanner(localLlmProvider, skillRegistry);
const llmProvider = new HybridLLMRouter(localLlmProvider, groqProvider, skillRegistry, planner);

const memoryService = new MemoryService();
const memoryManager = new MemoryManager(localLlmProvider, memoryService);
const ttsService = new TTSService();

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');
  const sessionId = Date.now().toString(); // Simple unique ID for the session/conversation

  let t_reqStart: number = 0;
  let t_qwenStart: number = 0;
  let t_qwenEnd: number = 0;
  let t_ttsStart: number = 0;
  let t_ttsEnd: number = 0;

  const conversation: LLMMessage[] = [
    {
      role: 'system',
      content: ADA_SYSTEM_PROMPT
    }
  ];

  ws.on('message', async (message: string) => {
    try {
      const data: any = JSON.parse(message.toString());
      if (data.type === 'latency_log') {
        const t_playbackStart = data.payload.ts;
        console.log(`\n\n=== LATENCY REPORT ===`);
        const plannerLat = (llmProvider as HybridLLMRouter).lastPlannerLatency || 0;
        const providerName = (llmProvider as HybridLLMRouter).lastUsedProvider || 'Qwen';
        const searchLat = (llmProvider as HybridLLMRouter).lastSearchLatency || 0;

        if (plannerLat > 0) {
            console.log(`0a. Planner (Qwen) request -> complete: ${plannerLat}ms`);
        }
        if (searchLat > 0) {
            console.log(`0b. SearXNG request -> complete: ${searchLat}ms`);
        }
        console.log(`1. Final LLM (${providerName}) request -> complete: ${t_qwenEnd - t_qwenStart}ms`);
        console.log(`2. LLM complete -> TTS start: ${t_ttsStart - t_qwenEnd}ms`);
        console.log(`3. TTS start -> TTS complete: ${t_ttsEnd - t_ttsStart}ms`);
        console.log(`4. TTS complete -> Playback start: ${t_playbackStart - t_ttsEnd}ms`);
        console.log(`5. TOTAL (User req -> Playback): ${t_playbackStart - t_reqStart}ms`);
        console.log(`======================\n\n`);
        return;
      }
      
      if (data.type === 'chat_message') {
        t_reqStart = Date.now();
        const userMsg = data.payload;
        console.log('Received message:', userMsg.text);

        const plannerStart = Date.now();
        const plan = await planner.plan(userMsg.text);
        (llmProvider as HybridLLMRouter).lastPlannerLatency = Date.now() - plannerStart;
        console.log('[Planner Decision]:', plan);
        
        let relevantContext: string | null = null;
        let isExplicitCommand = false;

        if (plan.action === 'respond') {
            relevantContext = await memoryManager.processExplicitCommands(userMsg.text);
            isExplicitCommand = !!relevantContext;
    
            if (!relevantContext) {
              relevantContext = memoryManager.getRelevantContext(userMsg.text);
            }
        }

        const userContentWithContext = (relevantContext || '') + userMsg.text;
        
        if (relevantContext) {
          console.log('[DEBUG-PROMPT-INJECTION] Injected memory context into prompt.');
          console.log('[DEBUG-PROMPT-INJECTION] Full user generation content:\n', userContentWithContext);
        }

        const generationMessages = [...conversation, {
          role: 'user',
          content: userContentWithContext
        }];

        conversation.push({
          role: 'user',
          content: userMsg.text
        });
        memoryService.saveConversationMessage(sessionId, 'user', userMsg.text);

        try {
          t_qwenStart = Date.now();
          
          let fullResponseText = '';
          let currentExtractedLength = 0;
          let ttsPromises: Promise<Buffer | null>[] = [];
          let firstTokenTime = 0;
          let firstAudioTime = 0;
          let ttsCalls = 0;
          const ttsBuffer = new TTSBuffer();

          const req: LLMRequest = { 
            messages: generationMessages as LLMMessage[],
            originalMessage: userMsg.text,
            injectedContext: relevantContext || '',
            plan: plan
          };
          for await (const chunk of llmProvider.generateStream!(req)) {
            if (!firstTokenTime) {
                firstTokenTime = Date.now();
                console.log(`[LATENCY] 1. First LLM token: ${firstTokenTime - t_reqStart}ms`);
            }
            fullResponseText += chunk;
            
            const textMatch = fullResponseText.match(/"text"\s*:\s*"([^"]*)/);
            if (textMatch) {
                const currentExtracted = textMatch[1];
                const newText = currentExtracted.substring(currentExtractedLength);
                if (newText) {
                    currentExtractedLength = currentExtracted.length;
                    
                    const unescapedNewText = newText.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                    const chunks = ttsBuffer.push(unescapedNewText);
                    
                    for (const chunk of chunks) {
                        ttsCalls++;
                        const p = ttsService.generateAudioBuffer(chunk, 'neutral', 0.5);
                        if (ttsPromises.length === 0) {
                            p.then(() => {
                                firstAudioTime = Date.now();
                                console.log(`[LATENCY] 2. First TTS audio chunk ready: ${firstAudioTime - t_reqStart}ms`);
                            });
                        }
                        ttsPromises.push(p);
                    }
                }
            }
          }
          t_qwenEnd = Date.now();

          let parsedResponse;
          try {
            const jsonMatch = fullResponseText.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : fullResponseText;
            parsedResponse = JSON.parse(jsonString);
          } catch (e) {
            console.error('Failed to parse LLM response as JSON:', fullResponseText);
            parsedResponse = { text: fullResponseText, emotion: 'neutral', intensity: 0.0, animation: 'neutral' };
          }

          if (!validateStructuredResponse(parsedResponse)) {
             if (typeof parsedResponse.text !== 'string') parsedResponse.text = fullResponseText;
             parsedResponse.emotion = 'neutral';
             parsedResponse.intensity = 0.0;
             parsedResponse.animation = 'neutral';
          }

          const leftover = ttsBuffer.flush();
          if (leftover) {
              ttsCalls++;
              const p = ttsService.generateAudioBuffer(leftover, parsedResponse.emotion, parsedResponse.intensity);
              if (ttsPromises.length === 0) {
                  p.then(() => {
                      firstAudioTime = Date.now();
                      console.log(`[LATENCY] 2. First TTS audio chunk ready: ${firstAudioTime - t_reqStart}ms`);
                  });
              }
              ttsPromises.push(p);
          }
          console.log(`[LATENCY] Total TTS synthesis calls: ${ttsCalls}`);

          conversation.push({ role: 'assistant', content: JSON.stringify(parsedResponse) });
          memoryService.saveConversationMessage(sessionId, 'assistant', JSON.stringify(parsedResponse));

          const responseMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: 'ada',
            text: parsedResponse.text,
            timestamp: Date.now(),
            emotion: parsedResponse.emotion,
            intensity: parsedResponse.intensity,
            animation: parsedResponse.animation
          };

          try {
            t_ttsStart = Date.now();
            const buffers = await Promise.all(ttsPromises);
            t_ttsEnd = Date.now();
            
            const validBuffers = buffers.filter(b => b !== null) as Buffer[];
            let audioBase64: string | undefined = undefined;
            if (validBuffers.length > 0) {
                const chunks = [validBuffers[0]];
                for (let i = 1; i < validBuffers.length; i++) {
                    chunks.push(validBuffers[i].slice(44)); // Strip WAV header
                }
                const concatBuf = Buffer.concat(chunks);
                concatBuf.writeUInt32LE(concatBuf.length - 8, 4); // ChunkSize
                concatBuf.writeUInt32LE(concatBuf.length - 44, 40); // Subchunk2Size
                audioBase64 = concatBuf.toString('base64');
            }
            if (audioBase64) {
              responseMsg.audioData = audioBase64;
            }
          } catch (err) {
            t_ttsEnd = Date.now();

            console.error('Failed to generate audio, continuing without TTS', err);
          }

          const wsResponse: WebSocketResponse = {
            type: 'chat_response',
            payload: responseMsg
          };

          ws.send(JSON.stringify(wsResponse));

          // Run extraction in background only if it wasn't an explicit command
          if (!isExplicitCommand) {
            memoryManager.extractMemoryBackground(userMsg.text);
          }
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
