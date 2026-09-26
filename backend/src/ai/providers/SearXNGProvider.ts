import { WebSearchProvider, SearchResult } from './WebSearchProvider.js';

export class SearXNGProvider implements WebSearchProvider {
  private apiUrl: string;

  constructor() {
    this.apiUrl = process.env.SEARXNG_URL || 'http://localhost:8080';
  }

  async search(query: string): Promise<SearchResult[]> {
    try {
      const response = await fetch(`${this.apiUrl}/search?q=${encodeURIComponent(query)}&format=json`);
      
      if (!response.ok) {
        throw new Error(`SearXNG error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return (data.results || []).slice(0, 5).map((result: any) => ({
        title: result.title || '',
        url: result.url || '',
        content: result.content || result.snippet || ''
      }));
    } catch (error) {
      console.error('SearXNG search failed:', error);
      throw error;
    }
  }
}
