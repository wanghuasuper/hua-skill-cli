import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadConfig } from "../config.js";

async function cleanup(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

async function fixture(): Promise<{ root: string; skill: string; config: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "hua-config-"));
  const skill = path.join(root, "source-skill");
  await mkdir(skill);
  await writeFile(path.join(skill, "SKILL.md"), "# Test skill\n");
  await writeFile(path.join(skill, "reference.md"), "# Reference\n");
  return { root, skill, config: path.join(root, "skills.json") };
}

test("loads a directory or arbitrary file path", async (t) => {
  const data = await fixture();
  t.after(() => cleanup(data.root));
  await writeFile(data.config, JSON.stringify({ categories: [{ id: "docs", name: "文档", skills: [
    { id: "directory", name: "目录", path: data.skill },
    { id: "file", name: "文件", path: path.join(data.skill, "reference.md") },
  ] }] }));
  const result = await loadConfig(data.config);
  assert.equal(result.errors.length, 0);
  assert.equal(result.categories[0].skills.length, 2);
  assert.equal(result.categories[0].skills[1].sourcePath, path.join(data.skill, "reference.md"));
});

test("keeps valid skills when other configuration entries are invalid", async (t) => {
  const data = await fixture();
  t.after(() => cleanup(data.root));
  await writeFile(data.config, JSON.stringify({ categories: [{ id: "docs", name: "文档", skills: [
    { id: "valid", name: "有效", path: data.skill },
    { id: "valid", name: "重复", path: data.skill },
    { id: "relative", name: "相对", path: "relative/path" },
  ] }] }));
  const result = await loadConfig(data.config);
  assert.equal(result.categories[0].skills.length, 1);
  assert.equal(result.errors.length, 2);
});
