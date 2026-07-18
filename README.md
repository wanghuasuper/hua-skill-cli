# Hua Skill CLI

一个在项目终端中运行的技能市场：从本机绝对路径读取技能，将它们安全复制到 Cursor、Codex 或 Claude 的项目级 skills 目录。

## 安装与启动

从 GitHub Release 安装：

```powershell
npm install -g https://github.com/wanghuasuper/hua-skill-cli/releases/download/v<版本号>/wanghuasuper-hua-skill-cli-<版本号>.tgz
hua
```

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
          "path": "D:\\skills\\web-design-guidelines",
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
- Hua 在 `<项目>/.hua/installed.json` 记录自己安装的内容；卸载只删除这些受管理目录。
- 目标已存在时，界面会要求再次按 Enter 确认覆盖。复制采用临时目录和备份替换，失败时保留原目录。

## 发布

执行 `npm version patch`（或 `minor`、`major`）更新版本；该命令会创建对应的 Git 标签，例如 `v0.1.1`。然后运行 `git push origin main --follow-tags`，GitHub Actions 会构建 npm 安装包并创建 GitHub Release。发布环境需要具备 `origin` 远程仓库的推送权限。

## 键盘操作

`Tab`/左右方向键切换页面，`↑`/`↓` 或 `j`/`k` 移动，`Enter` 选择/确认，`Space` 勾选目标，`r` 刷新，`u` 卸载，`b` 返回，`q` 退出。
