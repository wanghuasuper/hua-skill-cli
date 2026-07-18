# Hua Skill CLI

一个在项目终端中运行的技能市场：从本机绝对路径读取技能，将它们安全复制到 Cursor、Codex 或 Claude 的项目级 skills 目录。

## 安装与启动

从 GitHub Packages 安装（私有仓库推荐）：

```powershell
$env:GITHUB_TOKEN = "github_pat_你的Token"
npm.cmd config set @wanghuasuper:registry https://npm.pkg.github.com
npm.cmd config set //npm.pkg.github.com/:_authToken $env:GITHUB_TOKEN
npm.cmd install -g @wanghuasuper/hua-skill-cli
hua
```

Token 需要有该仓库中 Packages 的读取权限。上述配置会写入用户级 `.npmrc`；也可以手动加入以下内容，以便通过环境变量提供 Token：

```ini
@wanghuasuper:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

GitHub Release 仍会自动创建并保留 `.tgz` 附件，适合归档或离线安装；日常安装直接使用 `npm.cmd install -g @wanghuasuper/hua-skill-cli`。

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

推送标签会触发 GitHub Actions。工作流会执行 `npm ci`、构建项目、生成 `.tgz` 包、发布到 GitHub Packages，并创建同名的 GitHub Release。例如版本为 `0.1.11` 时，包可通过 `@wanghuasuper/hua-skill-cli@0.1.11` 安装，Release 也会上传 `wanghuasuper-hua-skill-cli-0.1.11.tgz`。

发布完成后依次确认：

1. 在 [Actions](https://github.com/wanghuasuper/hua-skill-cli/actions) 页面，`Publish GitHub Release` 工作流显示成功。
2. 在 [Releases](https://github.com/wanghuasuper/hua-skill-cli/releases) 页面，存在 `v0.1.11` Release。
3. 在仓库的 Packages 页面确认出现 `@wanghuasuper/hua-skill-cli` 的新版本。
4. 该 Release 的 **Assets** 中存在 `wanghuasuper-hua-skill-cli-0.1.11.tgz`，而不只是 `Source code (zip)` 和 `Source code (tar.gz)`。
5. 使用 GitHub Packages 安装并运行 `hua`：

   ```powershell
   npm.cmd install -g @wanghuasuper/hua-skill-cli
   hua
   ```

请从本地使用 `git push` 推送标签，不要仅在 GitHub 网页创建 Tag；当前工作流只监听 tag 的 `push` 事件。发布环境需要具备 `origin` 远程仓库的推送权限。

已发布版本不要修改或重新使用标签。如果某个版本发布失败，修复问题后使用 `npm.cmd version patch` 创建下一个版本并重新发布，例如从 `0.1.11` 发布 `0.1.12`。

## 键盘操作

`Tab`/左右方向键切换页面，`↑`/`↓` 或 `j`/`k` 移动，`Enter` 选择/确认，`Space` 勾选目标，`r` 刷新，`u` 卸载，`b` 返回，`q` 退出。
