import { access, cp, mkdir, readFile, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { TARGETS, type Category, type InstalledEntry, type InstallationLedger, type Skill, type Target } from "./types.js";

const targetFolders: Record<Target, string[]> = {
  cursor: [".cursor", "skills"],
  codex: [".agents", "skills"],
  claude: [".claude", "skills"],
};

export function targetDirectory(projectRoot: string, target: Target): string {
  return path.join(projectRoot, ...targetFolders[target]);
}

export function ledgerPath(projectRoot: string, target: Target): string {
  return path.join(targetDirectory(projectRoot, target), ".hua-installed.json");
}

function legacyLedgerPath(projectRoot: string): string {
  return path.join(projectRoot, ".hua", "installed.json");
}

async function readLedgerFile(filePath: string): Promise<InstallationLedger | undefined> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as Partial<InstallationLedger>;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) throw new Error("invalid ledger");
    return { version: 1, entries: parsed.entries as InstalledEntry[] };
  } catch {
    return undefined;
  }
}

async function writeLedgerFile(destination: string, ledger: InstallationLedger): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  await rename(temporary, destination);
}

async function writeLedger(projectRoot: string, ledger: InstallationLedger): Promise<void> {
  await Promise.all(TARGETS.map(async (target) => {
    const destination = ledgerPath(projectRoot, target);
    const entries = ledger.entries.filter((entry) => entry.target === target);
    if (!entries.length) {
      await rm(destination, { force: true });
      return;
    }
    await writeLedgerFile(destination, { version: 1, entries });
  }));
}

async function readTargetLedgers(projectRoot: string): Promise<InstalledEntry[]> {
  const ledgers = await Promise.all(TARGETS.map((target) => readLedgerFile(ledgerPath(projectRoot, target))));
  return ledgers.flatMap((ledger, index) => ledger?.entries.filter((entry) => entry.target === TARGETS[index]) ?? []);
}

async function migrateLegacyLedger(projectRoot: string): Promise<void> {
  const source = legacyLedgerPath(projectRoot);
  const legacy = await readLedgerFile(source);
  if (!legacy) return;

  const existing = await readTargetLedgers(projectRoot);
  const entries = new Map<string, InstalledEntry>();
  for (const entry of legacy.entries) entries.set(`${entry.target}:${entry.skillId}`, entry);
  for (const entry of existing) entries.set(`${entry.target}:${entry.skillId}`, entry);
  await writeLedger(projectRoot, { version: 1, entries: [...entries.values()] });
  await rm(source, { force: true });
  await rmdir(path.dirname(source)).catch(() => undefined);
}

export async function readLedger(projectRoot: string): Promise<InstallationLedger> {
  await migrateLegacyLedger(projectRoot);
  return { version: 1, entries: await readTargetLedgers(projectRoot) };
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
      await cp(skill.sourcePath, path.join(temporary, "SKILL.md"), {
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
