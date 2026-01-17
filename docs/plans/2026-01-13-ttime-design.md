# TTime 翻译软件设计文档

## 概述

TTime 是一款简洁高效的跨平台翻译软件，支持输入翻译、截图翻译、划词翻译功能，使用本地 Ollama 和智谱 GLM 大模型作为翻译引擎。

## 技术栈

- **前端**: React 18 + TypeScript + Vite
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **后端**: Tauri 2.0 + Rust
- **数据库**: SQLite (tauri-plugin-sql)
- **OCR**: Tesseract (tesseract-rs)
- **平台**: macOS + Windows

## 整体架构

```
┌─────────────────────────────────────────────────────┐
│                    TTime 应用                        │
├─────────────────────────────────────────────────────┤
│  前端 (React + TypeScript)                          │
│  ├── 主窗口 (输入翻译、历史、设置)                    │
│  ├── 悬浮窗 (划词/截图结果展示)                       │
│  └── 系统托盘菜单                                    │
├─────────────────────────────────────────────────────┤
│  Tauri IPC 通信层                                   │
├─────────────────────────────────────────────────────┤
│  后端 (Rust)                                        │
│  ├── 全局快捷键监听                                  │
│  ├── 剪贴板读取 (划词内容)                           │
│  ├── 截图模块                                       │
│  ├── OCR 模块 (Tesseract)                          │
│  ├── 翻译引擎 (Ollama / GLM API)                    │
│  └── 数据存储 (SQLite)                              │
└─────────────────────────────────────────────────────┘
```

## 功能模块

### 1. 窗口系统

#### 主窗口

- 默认隐藏，通过托盘图标或快捷键唤起
- 功能区域：
  - 输入翻译：顶部输入框，支持多行文本
  - 翻译结果：中部展示区，支持复制
  - 历史记录：侧边栏或标签页切换
  - 设置入口：右上角齿轮图标
- 尺寸：约 600x500，可调整

#### 系统托盘

- 左键点击：显示/隐藏主窗口
- 右键菜单：显示主窗口、划词翻译开关、截图翻译、设置、退出

### 2. 翻译引擎模块

#### 统一接口

```rust
trait TranslationEngine {
    fn translate(text: &str, from: Language, to: Language) -> Result<String>;
    fn test_connection() -> Result<bool>;
}
```

#### Ollama 引擎

- 连接本地 Ollama 服务（默认 `http://localhost:11434`）
- 支持配置：服务地址、模型名称（如 qwen2, llama3）
- 使用 `/api/generate` 或 `/api/chat` 接口

#### 智谱 GLM 引擎

- 调用智谱开放平台 API
- 支持配置：API Key、模型选择（glm-4、glm-4-flash 等）
- 使用官方 HTTP API，JWT 鉴权

#### 翻译 Prompt 模板

```
将以下{源语言}文本翻译成{目标语言}，只输出译文，不要解释：
{原文}
```

### 3. 截图与 OCR 模块

#### 截图流程

1. 用户按下截图快捷键
2. 创建全屏透明覆盖窗口
3. 用户拖拽选择区域
4. 确认选区（松开鼠标或按 Enter）
5. 截取选定区域图像
6. 传入 OCR 识别 → 翻译 → 显示结果

#### 截图实现

- macOS：使用 `screencapturekit` 或系统截图能力
- Windows：使用 `win-screenshot` crate

#### Tesseract OCR

- 使用 `tesseract-rs` crate
- 语言包：eng、chi_sim、chi_tra、jpn、kor、fra、deu
- 图像预处理：灰度化、二值化提升识别率

### 4. 划词翻译模块

#### 触发流程

1. 用户在任意应用中选中文字
2. 按下划词翻译快捷键
3. Rust 后端模拟复制并读取剪贴板
4. 获取当前鼠标位置
5. 调用翻译引擎
6. 在鼠标位置附近弹出悬浮窗

#### 实现细节

- 全局快捷键：`tauri-plugin-global-shortcut`
- 剪贴板操作：`tauri-plugin-clipboard-manager`
- 模拟按键：`enigo` crate
- 保存并恢复剪贴板原有内容，避免干扰用户

### 5. 数据存储模块

#### 数据库结构

```sql
-- 翻译历史表
CREATE TABLE history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    source_lang VARCHAR(10),
    target_lang VARCHAR(10),
    engine VARCHAR(50),
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 全文搜索索引
CREATE VIRTUAL TABLE history_fts USING fts5(source_text, translated_text);

-- 配置表
CREATE TABLE settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);
```

#### 存储位置

- macOS：`~/Library/Application Support/com.ttime.app/`
- Windows：`%APPDATA%/com.ttime.app/`

### 6. 设置页面

#### 通用设置

- 开机自启动
- 语言偏好：源语言、目标语言
- 主题切换：浅色/深色/跟随系统

#### 快捷键设置

- 划词翻译：默认 `Cmd/Ctrl + Shift + T`
- 截图翻译：默认 `Cmd/Ctrl + Shift + S`
- 显示主窗口：默认 `Cmd/Ctrl + Shift + Space`

#### 翻译引擎设置

- Ollama 配置：服务地址、模型名称、测试连接
- GLM 配置：API Key、模型选择、测试连接
- 设置默认引擎、拖拽排序优先级

#### OCR 设置

- 识别语言优先级
- 图像预处理开关

#### 数据管理

- 清空历史记录
- 导出/导入数据

## UI 设计

### 设计风格

- 简约现代风格（参考 Raycast/Linear）
- 圆角卡片、柔和阴影、清晰层次
- 字体：系统默认字体

### 配色方案

#### 浅色主题

- 背景：#FFFFFF
- 次级背景：#F5F5F5
- 文字：#1A1A1A
- 次级文字：#666666
- 强调色：#0066FF

#### 深色主题

- 背景：#1A1A1A
- 次级背景：#2A2A2A
- 文字：#FFFFFF
- 次级文字：#999999
- 强调色：#4D94FF

### 动效

- 窗口弹出：淡入 + 轻微缩放（150ms）
- 切换页面：滑动过渡
- 按钮交互：hover/active 状态反馈

## 项目结构

```
TTime/
├── src/                    # React 前端
│   ├── components/         # UI 组件
│   ├── pages/              # 页面（主窗口、设置）
│   ├── hooks/              # 自定义 hooks
│   ├── stores/             # Zustand 状态
│   ├── services/           # Tauri IPC 调用封装
│   └── styles/             # 全局样式
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/       # Tauri 命令
│   │   ├── translation/    # 翻译引擎
│   │   ├── ocr/            # OCR 模块
│   │   ├── clipboard/      # 剪贴板操作
│   │   └── database/       # SQLite 操作
│   └── Cargo.toml
├── docs/plans/             # 设计文档
└── package.json
```

## 支持语言

- 中文（简体/繁体）
- 英语
- 日语
- 韩语
- 法语
- 德语
