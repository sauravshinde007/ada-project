import { describe, it, expect } from 'vitest';
import { SkillRegistry } from '../skills/SkillRegistry.js';
import { WebSearchSkill } from '../skills/WebSearchSkill.js';
import { LLMPlanner } from './LLMPlanner.js';
import { HybridLLMRouter } from '../providers/HybridLLMRouter.js';

describe('LLM-Driven Skill & Planner Architecture', () => {
  it('SkillRegistry registers and retrieves skills', () => {
    const registry = new SkillRegistry();
    const mockSearchProvider = { search: async () => [] };
    const webSkill = new WebSearchSkill(mockSearchProvider);

    registry.registerSkill(webSkill);
    expect(registry.getSkill('web_search')).toBe(webSkill);
    expect(registry.getSkillDescriptions()).toContain('web_search');
  });

  it('WebSearchSkill executes correctly', async () => {
    const mockSearchProvider = {
      search: async (q: string) => [{ title: 'Arch Linux', url: 'https://archlinux.org', content: 'Arch 2026.03' }]
    };
    const webSkill = new WebSearchSkill(mockSearchProvider);

    const result = await webSkill.execute({ query: 'latest Arch' });
    expect(result.success).toBe(true);
    expect(result.data[0].title).toBe('Arch Linux');

    const invalid = await webSkill.execute({});
    expect(invalid.success).toBe(false);
  });

  it('LLMPlanner makes skill vs respond decisions', async () => {
    const registry = new SkillRegistry();
    registry.registerSkill(new WebSearchSkill({ search: async () => [] }));

    const mockLLMWeb = {
      generate: async () => ({
        content: JSON.stringify({ action: 'skill', skill: 'web_search', input: { query: 'latest Fedora' } })
      })
    };
    const plannerWeb = new LLMPlanner(mockLLMWeb, registry);
    const planWeb = await plannerWeb.plan('what is the latest Fedora release?');
    expect(planWeb.action).toBe('skill');
    if (planWeb.action === 'skill') {
      expect(planWeb.skill).toBe('web_search');
    }

    const mockLLMRespond = {
      generate: async () => ({ content: JSON.stringify({ action: 'respond' }) })
    };
    const plannerRespond = new LLMPlanner(mockLLMRespond, registry);
    const planRespond = await plannerRespond.plan('hello Ada');
    expect(planRespond.action).toBe('respond');
  });

  it('LLMPlanner falls back to respond on errors or invalid JSON', async () => {
    const registry = new SkillRegistry();
    const mockLLMError = {
      generate: async () => { throw new Error('LLM error'); }
    };
    const plannerError = new LLMPlanner(mockLLMError, registry);
    const planError = await plannerError.plan('explain Java interfaces');
    expect(planError.action).toBe('respond');
  });

  it('HybridLLMRouter executes skills and enforces Privacy Boundary', async () => {
    const registry = new SkillRegistry();
    registry.registerSkill(new WebSearchSkill({
      search: async () => [{ title: 'Fedora 42', url: 'https://fedoraproject.org', content: 'Fedora 42 released' }]
    }));

    let capturedCloudRequest: any = null;
    const mockLocalProvider = {
      generate: async () => ({ content: 'local' }),
      generateStream: async function* () { yield 'Local stream'; }
    };
    const mockCloudProvider = {
      generate: async () => ({ content: 'cloud' }),
      generateStream: async function* (req: any) {
        capturedCloudRequest = req;
        yield 'Cloud stream';
      }
    };
    const mockPlanner = {
      plan: async () => ({ action: 'skill' as const, skill: 'web_search', input: { query: 'latest Fedora' } })
    };

    const router = new HybridLLMRouter(mockLocalProvider, mockCloudProvider, registry, mockPlanner as any);

    const req: any = {
      messages: [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'PRIVATE MEMORY\nwhat is the latest Fedora release?' }
      ],
      originalMessage: 'what is the latest Fedora release?',
      injectedContext: 'PRIVATE MEMORY',
      plan: { action: 'skill', skill: 'web_search', input: { query: 'latest Fedora' } }
    };

    const chunks = [];
    for await (const chunk of router.generateStream(req)) {
      chunks.push(chunk);
    }

    expect(router.lastUsedProvider).toBe('Groq');
    expect(capturedCloudRequest).not.toBeNull();
    const cloudMessageStr = JSON.stringify(capturedCloudRequest);
    expect(cloudMessageStr).not.toContain('PRIVATE MEMORY');
    expect(cloudMessageStr).toContain('Search Results:');
  });

  it('HybridLLMRouter handles fallbacks on SearXNG or Groq failure', async () => {
    const failingRegistry = new SkillRegistry();
    failingRegistry.registerSkill(new WebSearchSkill({
      search: async () => { throw new Error('SearXNG down'); }
    }));

    const mockLocalProvider = {
      generate: async () => ({ content: 'local' }),
      generateStream: async function* () { yield 'Local fallback'; }
    };
    const mockCloudProvider = {
      generate: async () => ({ content: 'cloud' }),
      generateStream: async function* () { yield 'Cloud'; }
    };
    const mockPlanner = {
      plan: async () => ({ action: 'skill' as const, skill: 'web_search', input: { query: 'latest Fedora' } })
    };

    const router = new HybridLLMRouter(mockLocalProvider, mockCloudProvider, failingRegistry, mockPlanner as any);
    const req: any = {
      messages: [{ role: 'system', content: 'System' }, { role: 'user', content: 'latest Fedora' }],
      originalMessage: 'latest Fedora',
      plan: { action: 'skill', skill: 'web_search', input: { query: 'latest Fedora' } }
    };

    const chunks = [];
    for await (const chunk of router.generateStream(req)) {
      chunks.push(chunk);
    }

    expect(router.lastUsedProvider).toBe('Qwen');
    expect(chunks.join('')).toBe('Local fallback');
  });
});
