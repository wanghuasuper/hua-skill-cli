#!/usr/bin/env node
import path from "node:path";
import { defaultConfigPath } from "./config.js";
import { startTui } from "./tui.js";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(`hua - 项目技能终端管理器\n\n用法:\n  hua [--config <绝对路径>]\n\n默认读取已安装 hua 包内的 .hua/skills.json。\n`);
  process.exit(0);
}

const configIndex = args.indexOf("--config");
if (configIndex >= 0 && !args[configIndex + 1]) {
  process.stderr.write("--config 需要一个绝对路径。\n");
  process.exit(1);
}
const projectRoot = process.cwd();
const configPath = configIndex >= 0 ? path.resolve(args[configIndex + 1]) : defaultConfigPath();
await startTui(projectRoot, configPath);
