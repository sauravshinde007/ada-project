export interface SkillResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface Skill {
  name: string;
  description: string;
  execute(input: any): Promise<SkillResult>;
}
