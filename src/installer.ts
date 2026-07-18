import { access, cp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Category, InstalledEntry, InstallationLedger, Skill, Target } from "./types.js";

const targetFolders: Record<Target, string[]> = {
  cursor: [".cursor", "skills"],
  codex: [".agents", "skills"],
  claude: [".claude", "skills"],
};

export function targetDirectory(projectRoot: string, target: Target): string {
  return path.join(projectRoot, ...targetFolders[target]);
}

export function ledgerPath(projectRoot: string): string {
  return path.join(projectRoot, ".hua", "installed.json");
}

export async function readLedger(projectRoot: string): Promise<InstallationLedger> {
  try {
    const parsed = JSON.parse(await readFile(ledgerPath(projectRoot), "utf8")) as Partial<InstallationLedger>;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) throw new Error("invalid ledger");
    return { version: 1, entries: parsed.entries as InstalledEntry[] };
  } catch {
    return { version: 1, entries: [] };
  }
}

async function writeLedger(projectRoot: string, ledger: InstallationLedger): Promise<void> {
  const destination = ledgerPath(projectRoot);
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  await rename(temporary, destination);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function safeDestination(projectRoot: string, target: Target, skillId: string): string {
  const root = path.resolve(targetDirectory(projectRoot, target));
  const destination = path.resolve(root, skillId);
  if (destination === root || !destination.startsWith(`${root}${path.sep}`)) {
    throw new Error("无效的 skill id，拒绝写入目标目录之外。");
  }
  return destination;
}

export type InstallResult = { kind: "installed"; entry: InstalledEntry } | { kind: "conflict"; destination: string };

export async function installSkill(
  projectRoot: string,
  category: Category,
  skill: Skill,
  target: Target,
  overwrite = false,
): Promise<InstallResult> {
  const targetRoot = targetDirectory(projectRoot, target);
  const destination = safeDestination(projectRoot, target, skill.id);
  const destinationExists = await exists(destination);
  if (destinationExists && !overwrite) return { kind: "conflict", destination };

  await mkdir(targetRoot, { recursive: true });
  const temporary = path.join(targetRoot, `.hua-${skill.id}-${randomUUID()}.tmp`);
  const backup = `${destination}.${randomUUID()}.backup`;
  let movedOriginal = false;

  try {
    const sourceDetails = await stat(skill.sourcePath);
    if (sourceDetails.isDirectory()) {
      await cp(skill.sourcePath, temporary, { recursive: true, force: false, errorOnExist: true });
    } else {
      await mkdir(temporary);
      await cp(skill.sourcePath, path.join(temporary, path.basename(skill.sourcePath)), {
        force: false,
        errorOnExist: true,
      });
    }
    if (destinationExists) {
      await rename(destination, backup);
      movedOriginal = true;
    }
    await rename(temporary, destination);
    if (movedOriginal) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    if (movedOriginal && !(await exists(destination))) await rename(backup, destination);
    throw error;
  }

  const entry: InstalledEntry = {
    skillId: skill.id,
    skillName: skill.name,
    categoryId: category.id,
    target,
    sourcePath: skill.sourcePath,
    destination,
    installedAt: new Date().toISOString(),
  };
  const ledger = await readLedger(projectRoot);
  ledger.entries = ledger.entries.filter((item) => !(item.target === target && item.skillId === skill.id));
  ledger.entries.push(entry);
  await writeLedger(projectRoot, ledger);
  return { kind: "installed", entry };
}

export async function uninstallSkill(projectRoot: string, entry: InstalledEntry): Promise<void> {
  const expected = safeDestination(projectRoot, entry.target, entry.skillId);
  if (path.resolve(entry.destination) !== expected) {
    throw new Error("安装记录的目标路径异常，拒绝删除。");
  }
  await rm(expected, { recursive: true, force: true });
  const ledger = await readLedger(projectRoot);
  ledger.entries = ledger.entries.filter((item) => !(item.target === entry.target && item.skillId === entry.skillId));
  await writeLedger(projectRoot, ledger);
}
