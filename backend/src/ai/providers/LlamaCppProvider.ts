import { LLMProvider, LLMRequest, LLMResponse } from './LLMProvider.js';

export class LlamaCppProvider implements LLMProvider {
  private apiUrl: string;

  constructor(apiUrl?: string) {
    this.apiUrl = apiUrl || process.env.LLM_API_URL || 'http://127.0.0.1:8080';
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const response = await fetch(`${this.apiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        // The model parameter is required by standard OpenAI API format, 
        // though llama.cpp ignores it if only one model is loaded.
        model: 'local-model',
        reasoning_effort: 'none'
      })
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('Invalid response format from LLM API');
    }

    return { content };
  }

  async *generateStream(request: LLMRequest): AsyncGenerator<string> {
    const response = await fetch(`${this.apiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        model: 'local-model',
        stream: true,
        reasoning_effort: 'none'
      })
    });

    if (!response.ok || !response.body) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            const chunk = data.choices[0]?.delta?.content || '';
            if (chunk) {
              yield chunk;
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      }
    }
  }
}
