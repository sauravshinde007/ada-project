import { Skill } from './Skill.js';

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  public registerSkill(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }

  public getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  public getSkillDescriptions(): string {
    if (this.skills.size === 0) {
      return 'No skills currently available.';
    }
    return Array.from(this.skills.values())
      .map(s => `- ${s.name}: ${s.description}`)
      .join('\n');
  }

  public getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }
}
