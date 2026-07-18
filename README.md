# Hua Skill CLI

一个在项目终端中运行的技能市场：从本机绝对路径读取技能，将它们安全复制到 Cursor、Codex 或 Claude 的项目级 skills 目录。

## 安装与启动

发布后：

```powershell
npm install -g @wanghuasuper/hua-skill-cli
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

在要管理的项目中创建 `.hua/skills.json`，可从 [skills.example.json](.hua/skills.example.json) 复制。配置会从当前工作目录读取；也可以使用 `hua --config D:\\path\\skills.json` 指定绝对路径。

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

`path` 必须是本机绝对路径，可以是技能目录或其中的 `SKILL.md`。技能目录必须含有 `SKILL.md`。

## 行为与安全性

- 安装目标：`<项目>/.cursor/skills`、`<项目>/.agents/skills`、`<项目>/.claude/skills`。
- 安装时复制整个技能目录，并以 skill `id` 命名。
- Hua 在 `<项目>/.hua/installed.json` 记录自己安装的内容；卸载只删除这些受管理目录。
- 目标已存在时，界面会要求再次按 Enter 确认覆盖。复制采用临时目录和备份替换，失败时保留原目录。

## 键盘操作

`Tab`/左右方向键切换页面，`↑`/`↓` 或 `j`/`k` 移动，`Enter` 选择/确认，`Space` 勾选目标，`r` 刷新，`u` 卸载，`b` 返回，`q` 退出。

