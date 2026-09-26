import { LLMProvider, LLMRequest, LLMResponse } from './LLMProvider.js';
import { SkillRegistry } from '../skills/SkillRegistry.js';
import { LLMPlanner, PlanDecision } from '../planner/LLMPlanner.js';
import { SearchResult } from './WebSearchProvider.js';

export class HybridLLMRouter implements LLMProvider {
  public lastUsedProvider: 'Qwen' | 'Groq' = 'Qwen';
  public lastSearchLatency: number = 0;
  public lastPlannerLatency: number = 0;

  constructor(
    private localProvider: LLMProvider,
    private cloudProvider: LLMProvider,
    private skillRegistry: SkillRegistry,
    private planner: LLMPlanner
  ) {}

  async generate(request: LLMRequest): Promise<LLMResponse> {
    return this.localProvider.generate(request);
  }

  async *generateStream(request: LLMRequest): AsyncGenerator<string> {
    const userText = request.originalMessage || request.messages[request.messages.length - 1].content;
    
    this.lastUsedProvider = 'Qwen';
    this.lastSearchLatency = 0;
    this.lastPlannerLatency = 0;

    let plan: PlanDecision;
    if (request.plan) {
      plan = request.plan;
    } else {
      const plannerStart = Date.now();
      plan = await this.planner.plan(userText);
      this.lastPlannerLatency = Date.now() - plannerStart;
    }

    if (plan.action === 'skill') {
      const skill = this.skillRegistry.getSkill(plan.skill);
      if (skill) {
        try {
          console.log(`[HybridLLMRouter] Executing skill "${skill.name}" with input:`, plan.input);
          const searchStart = Date.now();
          const result = await skill.execute(plan.input);
          this.lastSearchLatency = Date.now() - searchStart;

          if (result.success && result.data) {
            const searchResults: SearchResult[] = Array.isArray(result.data) ? result.data : [];
            let searchContext = "Search Results:\n";
            if (searchResults.length === 0) {
              searchContext += "No results found.\n";
            } else {
              searchResults.forEach((r, i) => {
                searchContext += `${i + 1}. ${r.title} - ${r.url}\n${r.content}\n\n`;
              });
            }

            const systemPrompt = request.messages[0];
            const searchMessage = {
              role: 'user' as const,
              content: `${searchContext}\nUser query: ${userText}`
            };

            // Privacy boundary: Groq receives ONLY system prompt + search results + user query
            const cloudRequest: LLMRequest = {
              messages: [systemPrompt, searchMessage],
              temperature: request.temperature
            };

            console.log('[HybridLLMRouter] Routing to Groq with search context...');
            if (this.cloudProvider.generateStream) {
              this.lastUsedProvider = 'Groq';
              yield* this.cloudProvider.generateStream(cloudRequest);
              return;
            }
          } else {
            console.warn(`[HybridLLMRouter] Skill "${skill.name}" execution failed or returned no data:`, result.error);
          }
        } catch (e) {
          console.error(`[HybridLLMRouter] Skill/Cloud flow failed, falling back to local Qwen:`, e);
          this.lastUsedProvider = 'Qwen';
          this.lastSearchLatency = 0;
        }
      } else {
        console.warn(`[HybridLLMRouter] Planned skill "${plan.skill}" not found in registry. Falling back to local Qwen.`);
      }
    }

    console.log('[HybridLLMRouter] Routing to local Qwen...');
    if (this.localProvider.generateStream) {
      yield* this.localProvider.generateStream(request);
    }
  }
}
