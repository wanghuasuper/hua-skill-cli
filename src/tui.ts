import { existsSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "./config.js";
import { installSkill, readLedger, targetDirectory, uninstallSkill } from "./installer.js";
import { TARGETS, type Category, type InstalledEntry, type LoadResult, type Skill, type Target } from "./types.js";

const cyan = "\x1b[38;5;50m";
const muted = "\x1b[38;5;109m";
const white = "\x1b[38;5;255m";
const warning = "\x1b[38;5;221m";
const red = "\x1b[38;5;203m";
const reset = "\x1b[0m";
const bold = "\x1b[1m";

type Page = "project" | "market" | "mine" | "settings";
type MarketView = "categories" | "skills" | "details";

const pageLabels: Record<Page, string> = {
  project: "项目",
  market: "市场",
  mine: "我的技能",
  settings: "设置",
};

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1))}…`;
}

function boxLine(value: string, width: number): string {
  return `│ ${value.padEnd(Math.max(0, width - 4))} │`;
}

class HuaTui {
  private page: Page = "project";
  private marketView: MarketView = "categories";
  private cursor = 0;
  private categoryIndex = 0;
  private skillIndex = 0;
  private config: LoadResult;
  private installed: InstalledEntry[] = [];
  private selectedTargets = new Set<Target>();
  private message = "按 r 重新扫描配置和安装状态。";
  private confirmAction: (() => Promise<void>) | undefined;
  private stopped = false;

  constructor(private readonly projectRoot: string, private readonly configPath: string) {
    this.config = { configPath, categories: [], errors: [] };
  }

  async run(): Promise<void> {
    await this.reload();
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      process.stdout.write("hua 需要在交互式终端中运行。使用 hua --help 查看用法。\n");
      return;
    }
    process.stdout.write("\x1b[?1049h\x1b[?25l");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const handler = (key: string) => void this.handleKey(key);
    process.stdin.on("data", handler);
    this.render();

    await new Promise<void>((resolve) => {
      const finish = () => {
        process.stdin.off("data", handler);
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdout.write("\x1b[?25h\x1b[?1049l");
        resolve();
      };
      const interval = setInterval(() => {
        if (this.stopped) {
          clearInterval(interval);
          finish();
        }
      }, 30);
    });
  }

  private async reload(): Promise<void> {
    this.config = await loadConfig(this.configPath);
    this.installed = (await readLedger(this.projectRoot)).entries;
    this.cursor = 0;
    this.confirmAction = undefined;
    this.message = this.config.errors.length ? `已加载；发现 ${this.config.errors.length} 个配置问题。` : "扫描完成。";
  }

  private pages(): Page[] {
    return ["project", "market", "mine", "settings"];
  }

  private currentCategory(): Category | undefined {
    return this.config.categories[this.categoryIndex];
  }

  private currentSkill(): Skill | undefined {
    return this.currentCategory()?.skills[this.skillIndex];
  }

  private visibleInstalled(): InstalledEntry[] {
    return this.installed;
  }

  private move(delta: number): void {
    const count = this.itemCount();
    if (!count) return;
    this.cursor = (this.cursor + delta + count) % count;
  }

  private itemCount(): number {
    if (this.page === "market") {
      if (this.marketView === "categories") return this.config.categories.length;
      if (this.marketView === "skills") return this.currentCategory()?.skills.length ?? 0;
      return TARGETS.length;
    }
    if (this.page === "project" || this.page === "mine") return this.visibleInstalled().length;
    return 0;
  }

  private switchPage(direction: number): void {
    const pages = this.pages();
    this.page = pages[(pages.indexOf(this.page) + direction + pages.length) % pages.length];
    this.marketView = "categories";
    this.cursor = 0;
    this.confirmAction = undefined;
  }

  private async handleKey(key: string): Promise<void> {
    if (this.stopped) return;
    if (key === "\u0003" || key === "q") {
      this.stopped = true;
      return;
    }
    if (key === "r") {
      await this.reload();
      this.render();
      return;
    }
    if (key === "\t" || key === "\x1b[C") {
      this.switchPage(1);
      this.render();
      return;
    }
    if (key === "\x1b[D") {
      this.switchPage(-1);
      this.render();
      return;
    }
    if (key === "\x1b[A" || key === "k") {
      this.move(-1);
      this.render();
      return;
    }
    if (key === "\x1b[B" || key === "j") {
      this.move(1);
      this.render();
      return;
    }
    if (key === "b" || key === "\x1b") {
      if (this.page === "market" && this.marketView !== "categories") {
        this.marketView = this.marketView === "details" ? "skills" : "categories";
        this.cursor = 0;
        this.confirmAction = undefined;
      }
      this.render();
      return;
    }
    if (key === " ") {
      this.toggleTarget();
      this.render();
      return;
    }
    if (key === "u") {
      this.requestUninstall();
      this.render();
      return;
    }
    if (key === "\r") {
      if (this.confirmAction) {
        const action = this.confirmAction;
        this.confirmAction = undefined;
        await action();
      } else {
        await this.select();
      }
      this.render();
    }
  }

  private toggleTarget(): void {
    if (this.page !== "market" || this.marketView !== "details") return;
    const target = TARGETS[this.cursor];
    if (this.selectedTargets.has(target)) this.selectedTargets.delete(target);
    else this.selectedTargets.add(target);
  }

  private async select(): Promise<void> {
    if (this.page !== "market") return;
    if (this.marketView === "categories") {
      this.categoryIndex = this.cursor;
      this.marketView = "skills";
      this.cursor = 0;
      return;
    }
    if (this.marketView === "skills") {
      this.skillIndex = this.cursor;
      this.marketView = "details";
      this.cursor = 0;
      this.selectedTargets.clear();
      return;
    }
    await this.requestInstall(false);
  }

  private async requestInstall(overwrite: boolean): Promise<void> {
    const category = this.currentCategory();
    const skill = this.currentSkill();
    if (!category || !skill) return;
    if (!this.selectedTargets.size) {
      this.message = "请先使用 Space 勾选至少一个安装目标。";
      return;
    }
    const targets = [...this.selectedTargets];
    const conflicts = targets.filter((target) => existsSync(path.join(targetDirectory(this.projectRoot, target), skill.id)));
    if (conflicts.length && !overwrite) {
      this.message = `${conflicts.join("、")} 已存在 ${skill.id}。再次按 Enter 确认覆盖所有选定目标。`;
      this.confirmAction = () => this.requestInstall(true);
      return;
    }
    for (const target of targets) {
      const result = await installSkill(this.projectRoot, category, skill, target, overwrite);
      if (result.kind === "conflict") {
        this.message = `${target} 已存在 ${skill.id}。再次按 Enter 确认覆盖。`;
        this.confirmAction = () => this.requestInstall(true);
        return;
      }
    }
    this.installed = (await readLedger(this.projectRoot)).entries;
    this.message = `已安装 ${skill.name} 到 ${targets.join("、")}。`;
  }

  private requestUninstall(): void {
    if (this.page !== "project" && this.page !== "mine") return;
    const entry = this.visibleInstalled()[this.cursor];
    if (!entry) {
      this.message = "没有可卸载的 Hua 安装记录。";
      return;
    }
    this.message = `再次按 Enter 卸载 ${entry.skillName}（${entry.target}）。`;
    this.confirmAction = async () => {
      await uninstallSkill(this.projectRoot, entry);
      this.installed = (await readLedger(this.projectRoot)).entries;
      this.cursor = 0;
      this.message = `已卸载 ${entry.skillName}。`;
    };
  }

  private render(): void {
    const width = Math.max(72, Math.min(process.stdout.columns || 100, 140));
    const divider = "─".repeat(width - 2);
    const tabs = this.pages().map((page) => page === this.page ? `${cyan}${bold}${pageLabels[page]}${reset}` : `${muted}${pageLabels[page]}${reset}`).join("   ");
    const header = [
      `${cyan}┌${divider}┐${reset}`,
      `${cyan}${boxLine(`${bold}Hack Skill${reset} ${muted}v0.1.0${reset}                                      ${cyan}本地项目模式${reset}`, width)}${reset}`,
      `${cyan}${boxLine(`${white}Project ${truncate(this.projectRoot, width - 16)}${reset}`, width)}${reset}`,
      `${cyan}${boxLine(`${muted}Targets Cursor · Codex · Claude${reset}`, width)}${reset}`,
      `${cyan}└${divider}┘${reset}`,
      "",
      ` ${tabs}                                                     ${muted}${pageLabels[this.page]}${reset}`,
      "",
    ];
    const body = this.page === "project" ? this.renderInstalled("当前项目尚未安装技能。按 Tab 打开市场。")
      : this.page === "market" ? this.renderMarket()
        : this.page === "mine" ? this.renderInstalled("尚无由 Hua 管理的技能。")
          : this.renderSettings();
    const problems = this.config.errors.slice(0, 3).map((error) => `${red}! ${truncate(error, width - 4)}${reset}`);
    const footer = [
      ...problems,
      "",
      `${muted}${"─".repeat(width - 2)}${reset}`,
      `${muted}Tab/←→ 切换页面 · ↑↓ 移动 · Enter 选择/确认 · Space 勾选目标 · r 刷新 · u 卸载 · b 返回 · q 退出${reset}`,
      `${warning}${truncate(this.message, width - 1)}${reset}`,
    ];
    process.stdout.write(`\x1b[2J\x1b[H${[...header, ...body, ...footer].join("\n")}\n`);
  }

  private selectedPrefix(index: number): string {
    return index === this.cursor ? `${cyan}>${reset}` : " ";
  }

  private renderInstalled(emptyMessage: string): string[] {
    const entries = this.visibleInstalled();
    if (!entries.length) return [`${muted}${emptyMessage}${reset}`];
    return entries.map((entry, index) => {
      const state = existsSync(entry.destination) ? `${cyan}已安装${reset}` : `${red}文件缺失${reset}`;
      return `${this.selectedPrefix(index)} ${white}${entry.skillName}${reset} ${muted}(${entry.skillId}) · ${entry.target} · ${state}${reset}`;
    });
  }

  private renderMarket(): string[] {
    if (this.marketView === "categories") {
      if (!this.config.categories.length) return [`${muted}没有可用分类。请检查 ${this.config.configPath}${reset}`];
      return [
        `${muted}选择类目，按回车查看。${reset}`,
        ...this.config.categories.map((category, index) => `${this.selectedPrefix(index)} ${index === this.cursor ? `${cyan}${bold}` : white}${category.name} (${category.skills.length})${reset}`),
      ];
    }
    const category = this.currentCategory();
    if (!category) return [`${red}分类不存在。${reset}`];
    if (this.marketView === "skills") {
      return [
        `${cyan}${category.name}${reset} ${muted}· b 返回分类${reset}`,
        ...(category.skills.length ? category.skills.map((skill, index) => `${this.selectedPrefix(index)} ${index === this.cursor ? `${cyan}${bold}` : white}${skill.name}${reset} ${muted}(${skill.id})${reset}`) : [`${muted}此分类没有有效技能。${reset}`]),
      ];
    }
    const skill = this.currentSkill();
    if (!skill) return [`${red}技能不存在。${reset}`];
    return [
      `${cyan}${bold}${skill.name}${reset} ${muted}(${skill.id})${reset}`,
      `${muted}${skill.description ?? "未提供描述。"}${reset}`,
      `${muted}Path  ${truncate(skill.sourcePath, 100)}${reset}`,
      "",
      `${white}选择安装目标（Space 勾选，Enter 确认）：${reset}`,
      ...TARGETS.map((target, index) => `${this.selectedPrefix(index)} ${this.selectedTargets.has(target) ? `${cyan}[✓]${reset}` : `${muted}[ ]${reset}`} ${white}${target}${reset} ${muted}${targetDirectory(this.projectRoot, target)}${reset}`),
    ];
  }

  private renderSettings(): string[] {
    return [
      `${cyan}配置${reset}`,
      `${white}${this.config.configPath}${reset}`,
      "",
      `${cyan}安装目录${reset}`,
      ...TARGETS.map((target) => `${white}${target}${reset}  ${muted}${targetDirectory(this.projectRoot, target)}${reset}`),
      "",
      `${muted}默认配置来自已安装的 hua 包；可使用 --config 指定自定义配置文件。${reset}`,
    ];
  }
}

export async function startTui(projectRoot: string, configPath: string): Promise<void> {
  await new HuaTui(projectRoot, configPath).run();
}
