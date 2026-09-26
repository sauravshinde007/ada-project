import { LLMProvider, LLMRequest, LLMResponse } from './LLMProvider.js';

export class GroqProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) throw new Error('GROQ_API_KEY is not set');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        model: this.model
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('Invalid response format from Groq API');
    }

    return { content };
  }

  async *generateStream(request: LLMRequest): AsyncGenerator<string> {
    if (!this.apiKey) throw new Error('GROQ_API_KEY is not set');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        model: this.model,
        stream: true
      })
    });

    if (!response.ok || !response.body) {
      throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
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
