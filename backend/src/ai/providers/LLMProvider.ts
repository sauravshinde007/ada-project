import { PlanDecision } from '../planner/LLMPlanner.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  originalMessage?: string;
  injectedContext?: string;
  plan?: PlanDecision;
}

export interface LLMResponse {
  content: string;
}

export interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>;
  generateStream?(request: LLMRequest): AsyncGenerator<string>;
}
