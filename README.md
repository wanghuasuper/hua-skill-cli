# Hua Skill CLI

Hua Skill CLI 是一个在项目终端中运行的技能管理器。它从本机绝对路径读取技能，并将技能安装到 Cursor、Codex、Claude 或 Codefree 的项目级 skills 目录。

## 功能

- 按分类浏览技能，并查看技能描述和源文件路径。
- 将技能安装到 Cursor、Codex、Claude、Codefree 中的一个或多个目标。
- 支持技能目录、Markdown 文件和其他普通文件作为技能源。
- 安装前检测目标冲突，确认后安全覆盖。
- 记录 Hua 自己安装的目录，只卸载受管理的内容。
- 在市场详情页直接对当前选中的 Markdown 技能执行卸载。
- 使用 `--config` 指定项目外的自定义配置文件。

## 环境要求

- Node.js `>=22`
- Windows PowerShell、macOS 或 Linux 终端

## 安装

### 从 GitHub Packages 安装

仓库为私有仓库时，GitHub Packages 需要访问 Token。建议创建一个只拥有该仓库 Packages 读取权限的 Token，并在当前用户的 npm 配置中设置：

```powershell
$env:GITHUB_TOKEN = "github_pat_你的Token"
npm.cmd config set @wanghuasuper:registry https://npm.pkg.github.com
npm.cmd config set //npm.pkg.github.com/:_authToken $env:GITHUB_TOKEN
npm.cmd install -g @wanghuasuper/hua-skill-cli
```

安装完成后，在要管理的项目目录中运行：

```powershell
hua
```

也可以将下面内容写入用户级 `.npmrc`，通过环境变量提供 Token：

```ini
@wanghuasuper:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

私有 GitHub Release 的 `.tgz` 下载地址不能匿名访问，因此日常安装使用 GitHub Packages 包名。Release 中的 `.tgz` 仍用于归档或离线安装。

PowerShell 如果阻止 `npm.ps1`，请使用 `npm.cmd`，例如 `npm.cmd install`、`npm.cmd test`。

### 本地开发

```powershell
npm.cmd install
npm.cmd run build
npm.cmd link
hua
```

## 命令行参数

```text
hua [--config <绝对路径>]
hua --help
```

- 默认配置：已安装 Hua 包内的 `.hua/skills.json`。
- `--config`：指定一个本机绝对路径的 JSON 配置文件。
- 项目根目录：当前终端所在目录（`process.cwd()`）。

## 配置文件

配置必须是 `version: 1` 的 JSON 对象，并包含 `categories` 数组：

```json
{
  "version": 1,
  "categories": [
    {
      "id": "frontend",
      "name": "前端",
      "skills": [
        {
          "id": "frontend-design",
          "name": "前端设计",
          "path": "D:\\skills\\frontend-design\\SKILL.md",
          "description": "构建高质量前端界面。"
        }
      ]
    }
  ]
}
```

字段规则：

- `version` 必须为 `1`。
- `category.id`、`skill.id` 和名称不能为空；分类 ID 和技能 ID 不能重复。
- `path` 必须是存在的本机绝对路径，可以指向目录或文件。
- `description` 可选；无效配置项会显示在界面底部，其他有效技能仍可继续使用。

### 不同源路径的处理方式

- **目录**：复制整个目录，并以 `skill.id` 作为目标目录名。
- **Markdown 文件（`.md`）**：复制该文件所在目录中的其他文件和文件夹；被选中的 Markdown 文件在目标中重命名为 `SKILL.md`。
- **其他文件**：复制到目标技能目录，并重命名为 `SKILL.md`。

源目录中的 Cursor、Codex、Claude、Codefree 目标目录会被排除，避免把项目已有安装内容再次复制进去。

## 安装目标与记录

从项目根目录运行 `hua` 时，技能安装到：

```text
<项目>/.cursor/skills/<skill-id>
<项目>/.agents/skills/<skill-id>
<项目>/.claude/skills/<skill-id>
<项目>/.codefree/skills/<skill-id>
```

每个目标目录使用自己的 `.hua-installed.json` 记录安装信息。卸载只删除记录中由 Hua 管理的技能目录，不会删除其他文件，也不会在项目根目录创建新的 `.hua` 目录。旧版本遗留的 `<项目>/.hua/installed.json` 会在读取时自动迁移。

安装采用临时目录、备份和替换：目标已存在时需要再次按 `Enter` 确认覆盖；替换失败会尝试恢复原目录。

## 交互操作

| 按键 | 操作 |
| --- | --- |
| `Tab` / `←` `→` | 切换“项目 / 市场 / 我的技能 / 设置”页面 |
| `↑` `↓` / `j` `k` | 移动当前选项 |
| `Enter` | 进入分类、查看技能、安装或确认操作 |
| `Space` | 在市场详情页选择或取消安装目标 |
| `r` | 重新读取配置和安装记录 |
| `u` | 卸载当前选中的安装记录；市场详情页会卸载当前 Markdown 技能对应的已安装目录 |
| `b` / `Esc` | 返回上一级市场页面 |
| `q` / `Ctrl+C` | 退出 |

安装时先用 `Space` 选择至少一个目标，再按 `Enter`。如果目标已存在，按提示再次按 `Enter` 确认覆盖。卸载同样需要按 `Enter` 二次确认。

## 开发与测试

```powershell
npm.cmd run build
npm.cmd test
```

`npm.cmd test` 会先编译 TypeScript，然后运行配置和安装器测试。

如果 Windows 临时目录被其他进程占用导致测试出现 `EPERM`，可以把临时目录切到项目目录后重试：

```powershell
$env:TEMP = "$PWD\\.tmp-tests"
$env:TMP = "$PWD\\.tmp-tests"
npm.cmd test
```

## 发布版本

仓库中的 `.github/workflows/publish-github-release.yml` 监听 `v*` 标签推送。推送标签后，GitHub Actions 会自动构建、生成 `.tgz`、发布到 GitHub Packages，并创建同名 GitHub Release。

发布流程：

```powershell
git switch main
git pull --ff-only origin main
git status
npm.cmd test

# patch、minor 或 major
npm.cmd version patch

git push origin main --follow-tags
```

`npm.cmd version` 会同步更新 `package.json` 和 `package-lock.json`，创建版本提交和 `v<版本号>` 标签。例如当前版本为 `0.1.30` 时，`npm.cmd version patch` 会创建 `v0.1.31`。

推送完成后，在 GitHub Actions 中应看到 `Publish GitHub Release` 成功；对应 Release 应包含：

```text
wanghuasuper-hua-skill-cli-<版本号>.tgz
```

不要只在 GitHub 网页创建 Tag；当前工作流依赖本地 `git push` 的 tag 事件。已发布版本不要重复使用或修改标签，发布失败时修复后创建下一个版本重新发布。

发布
npm version patch
git push origin main --follow-tags

安装
npm install -g https://github.com/wanghuasuper/hua-skill-cli/releases/download/v0.1.30/wanghuasuper-hua-skill-cli-0.1.30.tgz

## 目录说明

```text
src/                         TypeScript 源码
src/cli.ts                   命令行入口
src/config.ts                配置读取与校验
src/installer.ts             安装、卸载和安装记录
src/tui.ts                   终端交互界面
src/test/                    自动化测试
.hua/skills.json             内置技能市场配置
.github/workflows/           GitHub Actions 发布工作流
dist/                        TypeScript 编译输出（构建生成）
```

## 许可证

MIT
