# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 授权与行为准则

- 你拥有对本项目的**完全读写权限**
- 在修改文件或运行测试（如 `npm test`, `cargo test`）之前，无需再次询问
- 允许自主执行环境检查和依赖安装
- 允许在发现 Bug 时直接尝试修复，修复后再向我报告结果

## 项目概述

LinguaFlash 是一款跨平台翻译软件，支持：
- 输入翻译、截图翻译、划词翻译
- Ollama（本地）和智谱 GLM（API）翻译引擎
- macOS 和 Windows 平台

## 常用命令

```bash
# 开发
npm run tauri dev          # 启动开发服务器（前端 + Tauri）

# 构建
npm run build              # 构建前端
npm run tauri build        # 构建完整应用

# Rust 后端
cd src-tauri && cargo check    # 类型检查
cd src-tauri && cargo build    # 编译
cd src-tauri && cargo test     # 运行测试
```

## 技术架构

```
┌─────────────────────────────────────────────┐
│  前端 (React + TypeScript + Tailwind)       │
│  - src/components/     UI 组件              │
│  - src/pages/          页面                 │
│  - src/stores/         Zustand 状态         │
│  - src/services/       Tauri IPC 调用封装   │
├─────────────────────────────────────────────┤
│  Tauri IPC 通信层                           │
├─────────────────────────────────────────────┤
│  后端 (Rust - src-tauri/src/)              │
│  - translation/        翻译引擎模块         │
│  - clipboard/          剪贴板操作           │
│  - tray/               系统托盘             │
│  - shortcut/           全局快捷键           │
└─────────────────────────────────────────────┘
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 5 |
| 样式 | Tailwind CSS |
| 状态管理 | Zustand |
| 桌面框架 | Tauri 2.0 |
| 后端语言 | Rust |
| 数据库 | SQLite (tauri-plugin-sql) |

## 快捷键

- `Cmd/Ctrl + Shift + T` - 划词翻译
- `Cmd/Ctrl + Shift + S` - 截图翻译
- `Cmd/Ctrl + Shift + Space` - 显示主窗口

## UI 配色

深浅色主题通过 Tailwind `darkMode: 'class'` 切换：
- 主色：`#0066FF`（浅色）/ `#4D94FF`（深色）
- 背景：`#FFFFFF` / `#1A1A1A`
- 次级背景：`#F5F5F5` / `#2A2A2A`

## 设计文档

详细设计和实现计划见 `docs/plans/` 目录。
