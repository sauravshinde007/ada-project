import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryService } from './MemoryService.js';
import fs from 'fs';
import path from 'path';

describe('MemoryService', () => {
  let memoryService: MemoryService;
  const testDbPath = path.resolve(process.cwd(), 'test_memory.sqlite');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    memoryService = new MemoryService(testDbPath);
  });

  afterEach(() => {
    memoryService.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should save and retrieve conversation messages', () => {
    const convId = 'test-conv-1';
    memoryService.saveConversationMessage(convId, 'user', 'Hello Ada');
    memoryService.saveConversationMessage(convId, 'assistant', 'Hello Creator');

    const messages = memoryService.getConversationMessages(convId);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Hello Ada');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toBe('Hello Creator');
  });

  it('should create and retrieve memories', () => {
    const mem1 = memoryService.createMemory('User likes coffee', 'preference', 5);
    const mem2 = memoryService.createMemory('Ada is a VTuber AI', 'fact', 3);

    expect(mem1.id).toBeDefined();
    expect(mem1.content).toBe('User likes coffee');

    const allMemories = memoryService.getMemories();
    expect(allMemories).toHaveLength(2);
    // Importance 5 should come first
    expect(allMemories[0].content).toBe('User likes coffee');
    expect(allMemories[1].content).toBe('Ada is a VTuber AI');

    const facts = memoryService.getMemories('fact');
    expect(facts).toHaveLength(1);
    expect(facts[0].content).toBe('Ada is a VTuber AI');
  });

  it('should search memories via LIKE query', () => {
    memoryService.createMemory('User works as a software engineer', 'fact', 1);
    memoryService.createMemory('User wants to learn Rust', 'goal', 4);

    const searchRes = memoryService.searchMemories('learn');
    expect(searchRes).toHaveLength(1);
    expect(searchRes[0].content).toContain('learn Rust');
  });

  it('should delete memories', () => {
    const mem = memoryService.createMemory('Temp fact', 'fact');
    expect(memoryService.getMemories()).toHaveLength(1);

    const result = memoryService.deleteMemory(mem.id);
    expect(result).toBe(true);
    expect(memoryService.getMemories()).toHaveLength(0);
  });
});
