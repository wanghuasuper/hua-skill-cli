export const TARGETS = ["cursor", "codex", "claude"] as const;

export type Target = (typeof TARGETS)[number];

export interface RawSkill {
  id?: unknown;
  name?: unknown;
  path?: unknown;
  description?: unknown;
}

export interface RawCategory {
  id?: unknown;
  name?: unknown;
  skills?: unknown;
}

export interface Skill {
  id: string;
  name: string;
  sourcePath: string;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  skills: Skill[];
}

export interface LoadResult {
  configPath: string;
  categories: Category[];
  errors: string[];
}

export interface InstalledEntry {
  skillId: string;
  skillName: string;
  categoryId: string;
  target: Target;
  sourcePath: string;
  destination: string;
  installedAt: string;
}

export interface InstallationLedger {
  version: 1;
  entries: InstalledEntry[];
}

