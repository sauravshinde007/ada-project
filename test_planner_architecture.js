import { SkillRegistry } from './backend/dist/backend/src/ai/skills/SkillRegistry.js';
import { WebSearchSkill } from './backend/dist/backend/src/ai/skills/WebSearchSkill.js';
import { LLMPlanner } from './backend/dist/backend/src/ai/planner/LLMPlanner.js';
import { HybridLLMRouter } from './backend/dist/backend/src/ai/providers/HybridLLMRouter.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${message}`);
  }
}

async function runTests() {
  console.log("=== 1. Testing SkillRegistry ===");
  const registry = new SkillRegistry();
  const mockSearchProvider = {
    search: async (q) => [{ title: 'Arch Linux', url: 'https://archlinux.org', content: 'Arch Linux 2026.03' }]
  };
  const webSkill = new WebSearchSkill(mockSearchProvider);
  registry.registerSkill(webSkill);

  assert(registry.getSkill('web_search') === webSkill, "SkillRegistry registers and retrieves web_search skill");
  assert(registry.getSkillDescriptions().includes('web_search'), "SkillRegistry formats skill descriptions");

  console.log("\n=== 2. Testing WebSearchSkill ===");
  const skillResult = await webSkill.execute({ query: 'latest Arch release' });
  assert(skillResult.success === true, "WebSearchSkill executes successfully");
  assert(skillResult.data[0].title === 'Arch Linux', "WebSearchSkill returns search results");

  const invalidResult = await webSkill.execute({});
  assert(invalidResult.success === false, "WebSearchSkill handles invalid input gracefully");

  console.log("\n=== 3. Testing LLMPlanner ===");
  const mockPlannerLLMWeb = {
    generate: async () => ({ content: JSON.stringify({ action: 'skill', skill: 'web_search', input: { query: 'latest Fedora' } }) })
  };
  const plannerWeb = new LLMPlanner(mockPlannerLLMWeb, registry);
  const planWeb = await plannerWeb.plan("what is the latest Fedora release?");
  assert(planWeb.action === 'skill' && planWeb.skill === 'web_search', "Planner plans web_search skill for factual prompt");

  const mockPlannerLLMRespond = {
    generate: async () => ({ content: JSON.stringify({ action: 'respond' }) })
  };
  const plannerRespond = new LLMPlanner(mockPlannerLLMRespond, registry);
  const planRespond = await plannerRespond.plan("hello Ada");
  assert(planRespond.action === 'respond', "Planner plans direct respond for casual prompt");

  const mockPlannerError = {
    generate: async () => { throw new Error("LLM failure"); }
  };
  const plannerError = new LLMPlanner(mockPlannerError, registry);
  const planError = await plannerError.plan("explain Java interfaces");
  assert(planError.action === 'respond', "Planner falls back to respond on LLM error");

  console.log("\n=== 4. Testing HybridLLMRouter & Privacy Boundary ===");
  let capturedCloudRequest = null;
  const mockLocalProvider = {
    generate: async () => ({ content: 'local' }),
    generateStream: async function* () { yield 'Local response stream'; }
  };
  const mockCloudProvider = {
    generate: async () => ({ content: 'cloud' }),
    generateStream: async function* (req) {
      capturedCloudRequest = req;
      yield 'Cloud response stream';
    }
  };

  const router = new HybridLLMRouter(mockLocalProvider, mockCloudProvider, registry, plannerWeb);

  const reqWithPrivacy = {
    messages: [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'SECRET MEMORY CONTEXT\nwhat is the latest Fedora release?' }
    ],
    originalMessage: 'what is the latest Fedora release?',
    injectedContext: 'SECRET MEMORY CONTEXT',
    plan: { action: 'skill', skill: 'web_search', input: { query: 'latest Fedora' } }
  };

  const chunks = [];
  for await (const chunk of router.generateStream(reqWithPrivacy)) {
    chunks.push(chunk);
  }

  assert(router.lastUsedProvider === 'Groq', "Router routes web_search to Groq");
  assert(capturedCloudRequest !== null, "Cloud provider received request");
  const cloudMessageStr = JSON.stringify(capturedCloudRequest);
  assert(!cloudMessageStr.includes('SECRET MEMORY CONTEXT'), "Privacy Boundary: Groq payload does NOT contain SQLite memory or injectedContext!");
  assert(cloudMessageStr.includes('Search Results:'), "Groq payload includes SearXNG search results");

  console.log("\n=== 5. Testing Router Fallbacks ===");
  // Test SearXNG / Skill Failure
  const failingRegistry = new SkillRegistry();
  const failingWebSkill = new WebSearchSkill({
    search: async () => { throw new Error("SearXNG offline"); }
  });
  failingRegistry.registerSkill(failingWebSkill);

  const fallbackRouter1 = new HybridLLMRouter(mockLocalProvider, mockCloudProvider, failingRegistry, plannerWeb);
  const fallbackChunks1 = [];
  for await (const chunk of fallbackRouter1.generateStream(reqWithPrivacy)) {
    fallbackChunks1.push(chunk);
  }
  assert(fallbackRouter1.lastUsedProvider === 'Qwen', "Router falls back to local Qwen when SearXNG skill fails");

  // Test Groq Failure
  const failingCloudProvider = {
    generate: async () => ({ content: 'error' }),
    generateStream: async function* () { throw new Error("Groq API error"); }
  };
  const fallbackRouter2 = new HybridLLMRouter(mockLocalProvider, failingCloudProvider, registry, plannerWeb);
  const fallbackChunks2 = [];
  for await (const chunk of fallbackRouter2.generateStream(reqWithPrivacy)) {
    fallbackChunks2.push(chunk);
  }
  assert(fallbackRouter2.lastUsedProvider === 'Qwen', "Router falls back to local Qwen when Groq cloud provider fails");

  console.log(`\n================================`);
  console.log(`Test Results: ${passedTests}/${totalTests} Passed`);
  console.log(`================================`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();
