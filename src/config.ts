import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Category, LoadResult, RawCategory, RawSkill, Skill } from "./types.js";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

async function normalizeSkillPath(value: string): Promise<string> {
  if (!path.isAbsolute(value)) {
    throw new Error("path 必须是磁盘绝对路径");
  }

  const input = path.normalize(value);
  const details = await stat(input);
  const root = details.isDirectory() ? input : path.dirname(input);

  if (!details.isDirectory() && path.basename(input).toLowerCase() !== "skill.md") {
    throw new Error("path 必须指向技能目录或 SKILL.md 文件");
  }

  const manifest = path.join(root, "SKILL.md");
  await access(manifest);
  return root;
}

async function validateSkill(
  raw: RawSkill,
  categoryId: string,
  index: number,
  knownSkillIds: Set<string>,
  errors: string[],
): Promise<Skill | undefined> {
  const label = `分类 ${categoryId} 的第 ${index + 1} 个 skill`;
  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.name) || !isNonEmptyString(raw.path)) {
    errors.push(`${label} 缺少 id、name 或 path。`);
    return undefined;
  }
  if (knownSkillIds.has(raw.id)) {
    errors.push(`${label} 的 id “${raw.id}” 重复。`);
    return undefined;
  }

  try {
    const sourcePath = await normalizeSkillPath(raw.path);
    knownSkillIds.add(raw.id);
    return {
      id: raw.id,
      name: raw.name,
      sourcePath,
      ...(isNonEmptyString(raw.description) ? { description: raw.description } : {}),
    };
  } catch (error) {
    errors.push(`${label}（${raw.name}）无效：${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

export async function loadConfig(configPath: string): Promise<LoadResult> {
  const result: LoadResult = { configPath: path.resolve(configPath), categories: [], errors: [] };
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(result.configPath, "utf8"));
  } catch (error) {
    result.errors.push(`无法读取配置 ${result.configPath}：${error instanceof Error ? error.message : String(error)}`);
    return result;
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { categories?: unknown }).categories)) {
    result.errors.push("配置必须是包含 categories 数组的 JSON 对象。");
    return result;
  }

  const knownCategoryIds = new Set<string>();
  const knownSkillIds = new Set<string>();
  const rawCategories = (parsed as { categories: unknown[] }).categories;

  for (const [categoryIndex, rawValue] of rawCategories.entries()) {
    const raw = rawValue as RawCategory;
    const label = `第 ${categoryIndex + 1} 个分类`;
    if (!raw || typeof raw !== "object" || !isNonEmptyString(raw.id) || !isNonEmptyString(raw.name) || !Array.isArray(raw.skills)) {
      result.errors.push(`${label} 缺少 id、name 或 skills 数组。`);
      continue;
    }
    if (knownCategoryIds.has(raw.id)) {
      result.errors.push(`${label} 的 id “${raw.id}” 重复。`);
      continue;
    }
    const categoryId = raw.id;
    const categoryName = raw.name;
    knownCategoryIds.add(categoryId);
    const skills: Skill[] = [];
    for (const [skillIndex, rawSkill] of raw.skills.entries()) {
      const skill = await validateSkill(
        (rawSkill ?? {}) as RawSkill,
        categoryId,
        skillIndex,
        knownSkillIds,
        result.errors,
      );
      if (skill) skills.push(skill);
    }
    result.categories.push({ id: categoryId, name: categoryName, skills });
  }

  return result;
}

export function defaultConfigPath(projectRoot: string): string {
  return path.join(projectRoot, ".hua", "skills.json");
}
