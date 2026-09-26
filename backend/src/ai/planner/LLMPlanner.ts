import { LLMProvider } from '../providers/LLMProvider.js';
import { SkillRegistry } from '../skills/SkillRegistry.js';

export type PlanDecision =
  | { action: 'respond' }
  | { action: 'skill'; skill: string; input: any };

export class LLMPlanner {
  constructor(
    private llmProvider: LLMProvider,
    private skillRegistry: SkillRegistry
  ) {}

  public async plan(userMessage: string): Promise<PlanDecision> {
    const skillDescriptions = this.skillRegistry.getSkillDescriptions();

    const systemPrompt = `You are Ada's intent planner.
Determine whether Ada can answer the user's message directly using her general knowledge, or if she should use an available skill.

Available skills:
${skillDescriptions}

Instructions:
- If answering the request requires current, live, or real-time information (e.g. latest software releases, upcoming game release dates, current weather, recent news, live scores, current pricing), select an appropriate skill (e.g. "web_search").
- If the request is casual conversation, general knowledge, explanation of concepts, opinions, creative writing, or personal chat (e.g. "hello Ada", "what are you doing today?", "explain Java interfaces", "tell me a story"), select "respond".
- Do NOT use a skill unnecessarily.
- Never invent skills that are not listed above.
- You MUST output ONLY a single valid JSON object matching one of the exact formats below with no extra text or markdown formatting.

Format for direct response:
{
  "action": "respond"
}

Format for skill execution:
{
  "action": "skill",
  "skill": "skill_name",
  "input": {
    "query": "search query"
  }
}`;

    try {
      const response = await this.llmProvider.generate({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.1
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && typeof parsed.action === 'string') {
          if (parsed.action === 'respond') {
            return { action: 'respond' };
          }
          if (parsed.action === 'skill' && typeof parsed.skill === 'string') {
            // Verify skill exists
            if (this.skillRegistry.getSkill(parsed.skill)) {
              return {
                action: 'skill',
                skill: parsed.skill,
                input: parsed.input || { query: userMessage }
              };
            } else {
              console.warn(`[LLMPlanner] Planned skill "${parsed.skill}" not registered. Falling back to respond.`);
            }
          }
        }
      }
      console.warn('[LLMPlanner] Could not parse valid plan decision from LLM response. Content:', response.content);
    } catch (error) {
      console.error('[LLMPlanner] Planning execution failed:', error);
    }

    // Default fallback
    return { action: 'respond' };
  }
}
