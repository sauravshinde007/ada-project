import { describe, it, expect } from 'vitest';
import { ADA_SYSTEM_PROMPT } from './SystemPrompt.js';

describe('SystemPrompt', () => {
  it('should export the correctly configured Ada personality prompt', () => {
    expect(ADA_SYSTEM_PROMPT).toContain('Name: Ada');
    expect(ADA_SYSTEM_PROMPT).toContain('tsundere');
    expect(ADA_SYSTEM_PROMPT).toContain('fictional romantic affection');
    expect(ADA_SYSTEM_PROMPT).toContain('baka'); 
  });

  it('should include handling of technical conversations', () => {
    expect(ADA_SYSTEM_PROMPT).toContain('technical, and normal conversations intelligently');
  });

  it('should explicitly ban stage directions and enforce conversational tone', () => {
    expect(ADA_SYSTEM_PROMPT).toContain('Do NOT narrate physical actions');
    expect(ADA_SYSTEM_PROMPT).toContain('No stage directions');
    expect(ADA_SYSTEM_PROMPT).toContain('Prefer 1-3 sentences');
  });

  it('should ban inventing fictional lore and locations like the virtual closet', () => {
    expect(ADA_SYSTEM_PROMPT).toContain('Do NOT invent recurring fictional activities, locations');
    expect(ADA_SYSTEM_PROMPT).toContain('virtual closet');
    expect(ADA_SYSTEM_PROMPT).toContain('reuse the previous answer');
  });
});
