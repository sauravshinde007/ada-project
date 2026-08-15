import { LlamaCppProvider } from '../ai/providers/LlamaCppProvider.js';
import { MemoryService, Memory } from './MemoryService.js';

const MEMORY_EXTRACTION_PROMPT = `You are a background memory extraction system. 
Analyze the user's message and determine if it contains important long-term facts, preferences, goals, projects, events, or relationship context about the user.
If it does, extract it. If it is casual conversation, temporary statements, greetings, or questions, ignore it (set shouldRemember to false).

You MUST output your ENTIRE response as a valid JSON object matching this exact schema:
{
  "shouldRemember": boolean,
  "content": "A concise statement of the fact (e.g. 'User likes coffee' or 'User's name is John')",
  "category": "fact" | "preference" | "goal" | "project" | "event" | "relationship",
  "importance": number from 0.0 to 1.0
}`;

export class MemoryManager {
  constructor(private llmProvider: LlamaCppProvider, private memoryService: MemoryService) {}

  public async extractMemoryBackground(userMessage: string): Promise<void> {
    try {
      const response = await this.llmProvider.generate({
        messages: [
          { role: 'system', content: MEMORY_EXTRACTION_PROMPT },
          { role: 'user', content: userMessage }
        ]
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.shouldRemember && parsed.content && parsed.category) {
          // Deduplicate
          const existing = this.memoryService.searchMemories(parsed.content, 5);
          const isDuplicate = existing.some(mem => mem.content.toLowerCase() === parsed.content.toLowerCase());
          
          if (!isDuplicate) {
            this.memoryService.createMemory(parsed.content, parsed.category, parsed.importance || 0.5);
            console.log('[DEBUG-MEMORY-EXTRACT] Created memory:', parsed.content);
          } else {
            console.log('[DEBUG-MEMORY-EXTRACT] Ignored duplicate memory:', parsed.content);
          }
        } else {
          console.log('[DEBUG-MEMORY-EXTRACT] LLM decided not to remember this.');
        }
      } else {
        console.log('[DEBUG-MEMORY-EXTRACT] No JSON found in LLM extraction response.');
      }
    } catch (e) {
      console.error('[MemoryManager] Failed to extract memory:', e);
    }
  }

  public async processExplicitCommands(userMessage: string): Promise<string | null> {
    const cleanMsg = userMessage.toLowerCase().replace(/[^\w\s]/g, '');

    // 1. What do you remember
    if (cleanMsg.includes('what do you remember about me') || cleanMsg.includes('what do you know about me')) {
      const allMemories = this.memoryService.getMemories();
      if (allMemories.length === 0) {
        return `[System Note: The user asked what you remember about them. You have ZERO memories stored. Tell them this politely.]\n\n`;
      }
      const contextLines = allMemories.map(m => `- [${m.source}] ${m.content}`);
      return `[System Note: The user asked what you remember about them. Here is your ENTIRE memory bank:\n${contextLines.join('\n')}\nPresent this information naturally and concisely.]\n\n`;
    }

    // 2. Forget that...
    const forgetMatch = userMessage.match(/(?:forget|remove) (?:that )?(.*)/i);
    if (forgetMatch) {
      const target = forgetMatch[1].trim();
      const allMemories = this.memoryService.getMemories();
      
      if (allMemories.length === 0) {
        return `[System Note: You tried to forget "${target}", but your memory bank is completely empty. Tell the user.]\n\n`;
      }

      // Use LLM to semantically match the target to the memory bank
      const memoryList = allMemories.map(m => `[ID: ${m.id}] ${m.content}`).join('\n');
      const FORGET_PROMPT = `You are a memory resolution system.
The user wants to delete a memory related to: "${target}"

Here is the current memory bank:
${memoryList}

Identify which memory ID(s) semantically match the user's request.
Account for spelling variants (e.g., favorite/favourite), spacing (e.g., one piece/onepiece), and perspective changes (e.g., "my" vs "User's").
Ignore filler words like "now", "please", "forget".
If multiple memories match the request equally, return all their IDs.
If no memories match, return an empty array.

Output a valid JSON object matching this exact schema:
{
  "matchedIds": [number],
  "confidence": "high" | "low"
}`;

      try {
        const response = await this.llmProvider.generate({
          messages: [{ role: 'system', content: FORGET_PROMPT }]
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          if (parsed.matchedIds && parsed.matchedIds.length === 1 && parsed.confidence === 'high') {
            const memoryToDelete = allMemories.find(m => m.id === parsed.matchedIds[0]);
            if (memoryToDelete) {
              this.memoryService.deleteMemory(memoryToDelete.id);
              console.log('[DEBUG-MEMORY-EXPLICIT] Deleted memory:', memoryToDelete.content);
              return `[System Note: You successfully deleted the memory: "${memoryToDelete.content}". Confirm this deletion concisely to the user.]\n\n`;
            }
          } else if (parsed.matchedIds && parsed.matchedIds.length > 1) {
             const matchedContents = parsed.matchedIds.map((id: number) => allMemories.find(m => m.id === id)?.content).filter(Boolean);
             return `[System Note: The user wants to forget "${target}", but multiple memories match: ${matchedContents.join(' AND ')}. Ask the user which specific one they meant.]\n\n`;
          }
        }
      } catch (e) {
        console.error('[MemoryManager] Failed LLM semantic match for forget:', e);
      }

      // Fallback or low confidence/no match
      return `[System Note: You tried to forget "${target}", but you didn't find any confidently matching memory stored. Tell the user.]\n\n`;
    }

    // 3. Remember that...
    const rememberMatch = userMessage.match(/remember (?:that )?(.*)/i);
    if (rememberMatch && !cleanMsg.includes('what do you remember')) {
       const fact = rememberMatch[1].trim();
       this.memoryService.createMemory(fact, 'fact', 1.0, 'explicit');
       console.log('[DEBUG-MEMORY-EXPLICIT] Created explicit memory:', fact);
       return `[System Note: You just explicitly saved this memory: "${fact}". Confirm this securely and concisely to the user.]\n\n`;
    }

    return null;
  }

  public getRelevantContext(userMessage: string): string {
    const cleanMsg = userMessage.toLowerCase().replace(/[^\w\s]/g, '');
    const keywords = cleanMsg.split(/\s+/).filter(w => w.length > 3);
    console.log('[DEBUG-MEMORY-RETRIEVAL] Search keywords:', keywords);
    if (keywords.length === 0) return '';

    const relevantMemories: Memory[] = [];
    for (const keyword of keywords) {
      const results = this.memoryService.searchMemories(keyword, 3);
      relevantMemories.push(...results);
    }

    const uniqueIds = new Set();
    const uniqueMemories = [];
    for (const mem of relevantMemories) {
      if (!uniqueIds.has(mem.id)) {
        uniqueIds.add(mem.id);
        uniqueMemories.push(mem);
      }
    }

    uniqueMemories.sort((a, b) => b.importance - a.importance);
    const topMemories = uniqueMemories.slice(0, 5);
    
    console.log(`[DEBUG-MEMORY-RETRIEVAL] Found ${topMemories.length} relevant memories`);
    if (topMemories.length > 0) {
      topMemories.forEach((m, i) => console.log(`[DEBUG-MEMORY-RETRIEVAL] Memory ${i+1}:`, m.content));
      const contextLines = topMemories.map(m => `- [${m.source}] ${m.content}`);
      return `[System Note: Recall these facts from past memory if relevant:\n${contextLines.join('\n')}]\n\n`;
    }
    
    return '';
  }
}
