# Hua Skill CLI

一个在项目终端中运行的技能市场：从本机绝对路径读取技能，将它们安全复制到 Cursor、Codex 或 Claude 的项目级 skills 目录。

## 安装与启动

从 GitHub Release 安装：

```powershell
npm.cmd install -g "https://github.com/wanghuasuper/hua-skill-cli/releases/download/v<版本号>/wanghuasuper-hua-skill-cli-<版本号>.tgz"
hua
```

例如，安装 `0.1.10`：

```powershell
npm.cmd install -g "https://github.com/wanghuasuper/hua-skill-cli/releases/download/v0.1.10/wanghuasuper-hua-skill-cli-0.1.10.tgz"
```

Release 标签带 `v`（如 `v0.1.10`），而 `.tgz` 文件名不带 `v`（如 `wanghuasuper-hua-skill-cli-0.1.10.tgz`）。

本地开发：

```powershell
npm install
npm link
hua
```

PowerShell 如果阻止 `npm.ps1`，请使用 `npm.cmd install`、`npm.cmd link`。

## 配置

默认读取已安装 `hua` 包内的 [skills.json](.hua/skills.json)，不会读取项目中的 `.hua/skills.json`。需要使用自定义配置时，可通过 `hua --config D:\\path\\skills.json` 指定绝对路径。

```json
{
  "version": 1,
  "categories": [
    {
      "id": "frontend",
      "name": "前端与网页",
      "skills": [
        {
          "id": "web-design-guidelines",
          "name": "Web 设计规范审查",
          "path": "D:\\skills\\web-design-guidelines\\web-design-guidelines.md",
          "description": "审查 UI、可访问性和体验。"
        }
      ]
    }
  ]
}
```

`path` 必须是本机绝对路径，可以指向任意文件或目录；文件名不要求为 `SKILL.md`。指定文件时，安装后会自动重命名为 `SKILL.md`。

## 行为与安全性

- 安装目标：`<项目>/.cursor/skills`、`<项目>/.agents/skills`、`<项目>/.claude/skills`。
- 安装时复制整个技能目录，并以 skill `id` 命名。
- Hua 在目标技能目录中记录自己安装的内容；卸载只删除这些受管理目录，不会在项目根目录创建 `.hua`。
- 目标已存在时，界面会要求再次按 Enter 确认覆盖。复制采用临时目录和备份替换，失败时保留原目录。

## 发布

### 自动发布到 GitHub Release（推荐）

每次发布都按以下顺序操作。先切换并同步主分支，避免在过期提交上创建版本标签：

```powershell
git switch main
git pull --ff-only origin main
```

确认工作区没有未提交的修改，并完成测试：

```powershell
git status
npm.cmd test
```

执行以下命令更新版本、创建提交和 Git 标签：

```powershell
npm.cmd version patch
# 或：npm.cmd version minor
# 或：npm.cmd version major
```

最后推送提交和标签：

```powershell
git push origin main --follow-tags
```

`npm.cmd version` 会同步更新 `package.json` 和 `package-lock.json`，创建一个版本提交和对应的 Git 标签；例如 `patch` 会将 `0.1.10` 升为 `0.1.11`，并创建标签 `v0.1.11`。`--follow-tags` 会把该标签一同推送到 GitHub。

推送标签会触发 GitHub Actions。工作流会执行 `npm ci`、构建项目、生成 `.tgz` 包，并创建同名的 GitHub Release。例如版本为 `0.1.11` 时，Release 会上传 `wanghuasuper-hua-skill-cli-0.1.11.tgz`。

发布完成后依次确认：

1. 在 [Actions](https://github.com/wanghuasuper/hua-skill-cli/actions) 页面，`Publish GitHub Release` 工作流显示成功。
2. 在 [Releases](https://github.com/wanghuasuper/hua-skill-cli/releases) 页面，存在 `v0.1.11` Release。
3. 该 Release 的 **Assets** 中存在 `wanghuasuper-hua-skill-cli-0.1.11.tgz`，而不只是 `Source code (zip)` 和 `Source code (tar.gz)`。
4. 使用 Release 附件链接安装并运行 `hua`：

   ```powershell
   npm.cmd install -g "https://github.com/wanghuasuper/hua-skill-cli/releases/download/v0.1.11/wanghuasuper-hua-skill-cli-0.1.11.tgz"
   hua
   ```

请从本地使用 `git push` 推送标签，不要仅在 GitHub 网页创建 Tag；当前工作流只监听 tag 的 `push` 事件。发布环境需要具备 `origin` 远程仓库的推送权限。

已发布版本不要修改或重新使用标签。如果某个版本发布失败，修复问题后使用 `npm.cmd version patch` 创建下一个版本并重新发布，例如从 `0.1.11` 发布 `0.1.12`。

### 手动创建 GitHub Release（备用）

当 Actions 未触发或需要补传附件时，可手动发布。先在项目根目录生成 npm 包：

```powershell
$env:npm_config_cache = "$PWD\.npm-cache"
npm.cmd pack
```

命令会生成与 `package.json` 版本对应的文件，例如 `wanghuasuper-hua-skill-cli-0.1.11.tgz`。然后：

1. 打开仓库的 [Releases](https://github.com/wanghuasuper/hua-skill-cli/releases) 页面，选择 **Draft a new release**；也可以在对应 Tag 页面点击 **Create release from tag**。
2. 选择或填写对应标签，例如 `v0.1.11`，并将标题设为 `v0.1.11`。
3. 将刚生成的 `wanghuasuper-hua-skill-cli-0.1.11.tgz` 拖入 **Attach binaries** 区域。
4. 点击 **Publish release**，再按上面的安装命令验证。

`Source code (zip)` 和 `Source code (tar.gz)` 是 GitHub 自动生成的仓库源码包，不是此项目用于全局安装的 npm `.tgz` 发布附件。

如果 PowerShell 因 npm 缓存目录权限而打包失败，可先在当前终端设置本地缓存：

```powershell
$env:npm_config_cache = "$PWD\.npm-cache"
```

## 键盘操作

`Tab`/左右方向键切换页面，`↑`/`↓` 或 `j`/`k` 移动，`Enter` 选择/确认，`Space` 勾选目标，`r` 刷新，`u` 卸载，`b` 返回，`q` 退出。
