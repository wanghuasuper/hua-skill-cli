import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { installSkill, readLedger, targetDirectory, uninstallSkill } from "../installer.js";
import type { Category, Skill } from "../types.js";

async function cleanup(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

async function fixture(): Promise<{ root: string; category: Category; skill: Skill }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "hua-installer-"));
  const sourcePath = path.join(root, "source");
  await mkdir(sourcePath);
  await writeFile(path.join(sourcePath, "SKILL.md"), "# Source\n");
  await writeFile(path.join(sourcePath, "note.txt"), "copied");
  const skill: Skill = { id: "source-skill", name: "Source skill", sourcePath };
  return { root, category: { id: "test", name: "Test", skills: [skill] }, skill };
}

test("copies a skill, records it, and only uninstalls its tracked destination", async (t) => {
  const data = await fixture();
  t.after(() => cleanup(data.root));
  const result = await installSkill(data.root, data.category, data.skill, "codex");
  assert.equal(result.kind, "installed");
  const destination = path.join(targetDirectory(data.root, "codex"), data.skill.id);
  assert.equal(await readFile(path.join(destination, "note.txt"), "utf8"), "copied");
  const ledger = await readLedger(data.root);
  assert.equal(ledger.entries.length, 1);
  await uninstallSkill(data.root, ledger.entries[0]);
  assert.equal((await readLedger(data.root)).entries.length, 0);
});

test("copies an arbitrary source file into the skill directory", async (t) => {
  const data = await fixture();
  t.after(() => cleanup(data.root));
  const sourcePath = path.join(data.root, "guide.md");
  await writeFile(sourcePath, "# Guide\n");
  const skill: Skill = { id: "guide", name: "Guide", sourcePath };
  const result = await installSkill(data.root, data.category, skill, "codex");
  assert.equal(result.kind, "installed");
  const destination = path.join(targetDirectory(data.root, "codex"), skill.id, "guide.md");
  assert.equal(await readFile(destination, "utf8"), "# Guide\n");
});

test("reports a conflict without replacing an existing skill", async (t) => {
  const data = await fixture();
  t.after(() => cleanup(data.root));
  const existing = path.join(targetDirectory(data.root, "cursor"), data.skill.id);
  await mkdir(existing, { recursive: true });
  await writeFile(path.join(existing, "keep.txt"), "do not remove");
  const result = await installSkill(data.root, data.category, data.skill, "cursor");
  assert.equal(result.kind, "conflict");
  assert.equal(await readFile(path.join(existing, "keep.txt"), "utf8"), "do not remove");
});

test("replaces a confirmed conflict and refreshes the ledger entry", async (t) => {
  const data = await fixture();
  t.after(() => cleanup(data.root));
  const existing = path.join(targetDirectory(data.root, "claude"), data.skill.id);
  await mkdir(existing, { recursive: true });
  await writeFile(path.join(existing, "old.txt"), "old");
  const result = await installSkill(data.root, data.category, data.skill, "claude", true);
  assert.equal(result.kind, "installed");
  assert.equal(await readFile(path.join(existing, "note.txt"), "utf8"), "copied");
  assert.equal((await readLedger(data.root)).entries[0].target, "claude");
});
