import { Skill, SkillResult } from './Skill.js';
import { WebSearchProvider } from '../providers/WebSearchProvider.js';

export class WebSearchSkill implements Skill {
  public name = 'web_search';
  public description = 'Search the web for real-time, current, live, or time-sensitive information (e.g. recent news, current weather, release dates, current prices, live events). Input format: { "query": "search query string" }';

  constructor(private searchProvider: WebSearchProvider) {}

  async execute(input: any): Promise<SkillResult> {
    try {
      const query = typeof input === 'string' ? input : input?.query;
      if (!query || typeof query !== 'string') {
        return { success: false, error: 'Valid query string is required for web_search' };
      }

      const results = await this.searchProvider.search(query);
      return { success: true, data: results };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Web search failed' };
    }
  }
}
