import { describe, it, expect, vi } from 'vitest';
import { LlamaCppProvider } from './LlamaCppProvider.js';

// Mock the global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LlamaCppProvider', () => {
  it('should call the correct API endpoint and return content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Hello, this is Ada!'
            }
          }
        ]
      })
    });

    const provider = new LlamaCppProvider('http://127.0.0.1:8080');
    
    const response = await provider.generate({
      messages: [
        { role: 'user', content: 'Hi' }
      ]
    });

    expect(response.content).toBe('Hello, this is Ada!');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: expect.any(String)
      })
    );
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    const provider = new LlamaCppProvider('http://127.0.0.1:8080');

    await expect(
      provider.generate({
        messages: [{ role: 'user', content: 'Hi' }]
      })
    ).rejects.toThrow('LLM API error: 500 Internal Server Error');
  });
});
