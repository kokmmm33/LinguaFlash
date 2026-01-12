# TTime 翻译软件实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个跨平台的输入、截图、划词翻译软件，支持 Ollama 和 GLM 大模型翻译引擎。

**Architecture:** 单进程 Tauri 架构，Rust 后端处理系统级功能（快捷键、截图、OCR、翻译 API），React 前端负责 UI 渲染。使用 SQLite 存储历史记录和配置。

**Tech Stack:** Tauri 2.0, React 18, TypeScript, Vite, Tailwind CSS, Zustand, SQLite, Tesseract OCR

---

## Phase 1: 项目初始化

### Task 1: 创建 Tauri + React 项目

**Files:**
- Create: `package.json`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.js`

**Step 1: 使用 Tauri CLI 创建项目**

Run:
```bash
npm create tauri-app@latest . -- --template react-ts --manager npm
```

Expected: 生成 Tauri + React + TypeScript 项目结构

**Step 2: 安装 Tailwind CSS**

Run:
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Step 3: 配置 Tailwind**

修改 `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#0066FF',
        'primary-dark': '#4D94FF',
      }
    },
  },
  plugins: [],
}
```

修改 `src/styles.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: 安装前端依赖**

Run:
```bash
npm install zustand @tauri-apps/api
```

**Step 5: 验证项目可运行**

Run:
```bash
npm run tauri dev
```

Expected: 应用窗口正常启动

**Step 6: Commit**

```bash
git add .
git commit -m "feat: initialize Tauri + React + TypeScript project with Tailwind CSS"
```

---

### Task 2: 配置 Tauri 窗口和权限

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/capabilities/main.json`

**Step 1: 配置主窗口**

修改 `src-tauri/tauri.conf.json`:
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "TTime",
  "identifier": "com.ttime.app",
  "version": "0.1.0",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "label": "main",
        "title": "TTime",
        "width": 600,
        "height": 500,
        "resizable": true,
        "center": true,
        "visible": false,
        "decorations": true,
        "transparent": false
      }
    ],
    "trayIcon": {
      "iconPath": "icons/icon.png",
      "iconAsTemplate": true
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

**Step 2: 添加 Tauri 插件依赖**

修改 `src-tauri/Cargo.toml`，在 `[dependencies]` 中添加:
```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-global-shortcut = "2"
tauri-plugin-clipboard-manager = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["full"] }
```

**Step 3: 创建权限配置**

创建 `src-tauri/capabilities/main.json`:
```json
{
  "$schema": "https://schemas.tauri.app/config/2/capability",
  "identifier": "main-capability",
  "description": "Main window capability",
  "windows": ["main", "popup"],
  "permissions": [
    "core:default",
    "sql:default",
    "sql:allow-execute",
    "sql:allow-select",
    "global-shortcut:default",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "clipboard-manager:default",
    "clipboard-manager:allow-read-text",
    "clipboard-manager:allow-write-text",
    "shell:default"
  ]
}
```

**Step 4: 安装前端插件包**

Run:
```bash
npm install @tauri-apps/plugin-sql @tauri-apps/plugin-global-shortcut @tauri-apps/plugin-clipboard-manager @tauri-apps/plugin-shell
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: configure Tauri windows, plugins and permissions"
```

---

## Phase 2: 基础 UI 框架

### Task 3: 创建基础布局组件

**Files:**
- Create: `src/components/Layout.tsx`
- Create: `src/components/Sidebar.tsx`
- Create: `src/components/TitleBar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Step 1: 创建全局样式**

修改 `src/styles.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-primary: #FFFFFF;
  --bg-secondary: #F5F5F5;
  --text-primary: #1A1A1A;
  --text-secondary: #666666;
  --accent: #0066FF;
}

.dark {
  --bg-primary: #1A1A1A;
  --bg-secondary: #2A2A2A;
  --text-primary: #FFFFFF;
  --text-secondary: #999999;
  --accent: #4D94FF;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--text-secondary);
  border-radius: 3px;
}
```

**Step 2: 创建自定义标题栏**

创建 `src/components/TitleBar.tsx`:
```tsx
import { getCurrentWindow } from '@tauri-apps/api/window';

export function TitleBar() {
  const appWindow = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="h-10 flex items-center justify-between px-4 bg-[var(--bg-secondary)] select-none"
    >
      <div data-tauri-drag-region className="flex items-center gap-2">
        <span className="text-sm font-medium">TTime</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => appWindow.minimize()}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={() => appWindow.close()}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500 hover:text-white"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

**Step 3: 创建侧边栏**

创建 `src/components/Sidebar.tsx`:
```tsx
import { useState } from 'react';

type Tab = 'translate' | 'history' | 'settings';

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const tabs = [
    { id: 'translate' as Tab, label: '翻译', icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129' },
    { id: 'history' as Tab, label: '历史', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'settings' as Tab, label: '设置', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  return (
    <div className="w-16 bg-[var(--bg-secondary)] flex flex-col items-center py-4 gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg transition-colors ${
            activeTab === tab.id
              ? 'bg-[var(--accent)] text-white'
              : 'hover:bg-black/10 dark:hover:bg-white/10'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={tab.icon} />
          </svg>
          <span className="text-xs mt-1">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
```

**Step 4: 创建布局组件**

创建 `src/components/Layout.tsx`:
```tsx
import { useState, ReactNode } from 'react';
import { TitleBar } from './TitleBar';
import { Sidebar } from './Sidebar';

type Tab = 'translate' | 'history' | 'settings';

interface LayoutProps {
  children: (activeTab: Tab) => ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [activeTab, setActiveTab] = useState<Tab>('translate');

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 overflow-auto p-4">
          {children(activeTab)}
        </main>
      </div>
    </div>
  );
}
```

**Step 5: 更新 App.tsx**

修改 `src/App.tsx`:
```tsx
import { Layout } from './components/Layout';

function App() {
  return (
    <Layout>
      {(activeTab) => (
        <div className="h-full">
          {activeTab === 'translate' && <div>翻译页面</div>}
          {activeTab === 'history' && <div>历史页面</div>}
          {activeTab === 'settings' && <div>设置页面</div>}
        </div>
      )}
    </Layout>
  );
}

export default App;
```

**Step 6: 验证 UI 显示正常**

Run:
```bash
npm run tauri dev
```

Expected: 显示带有侧边栏和标题栏的主窗口

**Step 7: Commit**

```bash
git add .
git commit -m "feat: add basic layout with sidebar and title bar"
```

---

### Task 4: 创建翻译页面 UI

**Files:**
- Create: `src/pages/TranslatePage.tsx`
- Create: `src/components/TextArea.tsx`
- Create: `src/components/LanguageSelector.tsx`
- Modify: `src/App.tsx`

**Step 1: 创建文本输入组件**

创建 `src/components/TextArea.tsx`:
```tsx
interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

export function TextArea({ value, onChange, placeholder, readOnly, className = '' }: TextAreaProps) {
  return (
    <div className={`relative ${className}`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full h-full min-h-[120px] p-3 bg-[var(--bg-secondary)] rounded-lg resize-none
                   border border-transparent focus:border-[var(--accent)] focus:outline-none
                   placeholder:text-[var(--text-secondary)]"
      />
      {value && !readOnly && (
        <button
          onClick={() => onChange('')}
          className="absolute top-2 right-2 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
        >
          <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
```

**Step 2: 创建语言选择器**

创建 `src/components/LanguageSelector.tsx`:
```tsx
const LANGUAGES = [
  { code: 'auto', name: '自动检测' },
  { code: 'zh', name: '中文' },
  { code: 'en', name: '英语' },
  { code: 'ja', name: '日语' },
  { code: 'ko', name: '韩语' },
  { code: 'fr', name: '法语' },
  { code: 'de', name: '德语' },
];

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  showAuto?: boolean;
}

export function LanguageSelector({ value, onChange, showAuto = true }: LanguageSelectorProps) {
  const options = showAuto ? LANGUAGES : LANGUAGES.filter(l => l.code !== 'auto');

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-1.5 bg-[var(--bg-secondary)] rounded-lg border border-transparent
                 focus:border-[var(--accent)] focus:outline-none text-sm cursor-pointer"
    >
      {options.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  );
}

export { LANGUAGES };
```

**Step 3: 创建翻译页面**

创建 `src/pages/TranslatePage.tsx`:
```tsx
import { useState } from 'react';
import { TextArea } from '../components/TextArea';
import { LanguageSelector } from '../components/LanguageSelector';

export function TranslatePage() {
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('zh');
  const [isLoading, setIsLoading] = useState(false);

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    setIsLoading(true);
    // TODO: 调用翻译 API
    setTargetText('翻译结果将显示在这里');
    setIsLoading(false);
  };

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto') return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(targetText);
    setTargetText(sourceText);
  };

  const handleCopy = async () => {
    if (targetText) {
      await navigator.clipboard.writeText(targetText);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* 语言选择栏 */}
      <div className="flex items-center gap-2">
        <LanguageSelector value={sourceLang} onChange={setSourceLang} showAuto />
        <button
          onClick={handleSwapLanguages}
          disabled={sourceLang === 'auto'}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </button>
        <LanguageSelector value={targetLang} onChange={setTargetLang} showAuto={false} />
      </div>

      {/* 输入区域 */}
      <TextArea
        value={sourceText}
        onChange={setSourceText}
        placeholder="输入要翻译的文本..."
        className="flex-1"
      />

      {/* 翻译按钮 */}
      <button
        onClick={handleTranslate}
        disabled={!sourceText.trim() || isLoading}
        className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg font-medium
                   hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-opacity"
      >
        {isLoading ? '翻译中...' : '翻译'}
      </button>

      {/* 结果区域 */}
      <div className="flex-1 relative">
        <TextArea
          value={targetText}
          onChange={setTargetText}
          placeholder="翻译结果"
          readOnly
          className="h-full"
        />
        {targetText && (
          <div className="absolute bottom-2 right-2 flex gap-1">
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg bg-[var(--bg-primary)] hover:bg-black/10 dark:hover:bg-white/10"
              title="复制"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: 更新 App.tsx**

修改 `src/App.tsx`:
```tsx
import { Layout } from './components/Layout';
import { TranslatePage } from './pages/TranslatePage';

function App() {
  return (
    <Layout>
      {(activeTab) => (
        <div className="h-full">
          {activeTab === 'translate' && <TranslatePage />}
          {activeTab === 'history' && <div>历史页面</div>}
          {activeTab === 'settings' && <div>设置页面</div>}
        </div>
      )}
    </Layout>
  );
}

export default App;
```

**Step 5: 验证翻译页面显示正常**

Run:
```bash
npm run tauri dev
```

Expected: 显示翻译页面，包含输入框、语言选择、翻译按钮和结果区域

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add translate page with text input and language selector"
```

---

## Phase 3: 翻译引擎模块

### Task 5: 实现 Rust 翻译引擎接口

**Files:**
- Create: `src-tauri/src/translation/mod.rs`
- Create: `src-tauri/src/translation/ollama.rs`
- Create: `src-tauri/src/translation/glm.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/main.rs`

**Step 1: 创建翻译模块结构**

创建 `src-tauri/src/translation/mod.rs`:
```rust
pub mod ollama;
pub mod glm;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationRequest {
    pub text: String,
    pub source_lang: String,
    pub target_lang: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationResponse {
    pub translated_text: String,
    pub detected_lang: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    pub engine_type: String,  // "ollama" or "glm"
    pub endpoint: Option<String>,
    pub model: Option<String>,
    pub api_key: Option<String>,
}

pub fn build_translation_prompt(text: &str, source_lang: &str, target_lang: &str) -> String {
    let source = if source_lang == "auto" {
        "检测到的语言".to_string()
    } else {
        get_language_name(source_lang)
    };
    let target = get_language_name(target_lang);

    format!(
        "将以下{}文本翻译成{}，只输出译文，不要解释：\n{}",
        source, target, text
    )
}

fn get_language_name(code: &str) -> String {
    match code {
        "zh" => "中文",
        "en" => "英语",
        "ja" => "日语",
        "ko" => "韩语",
        "fr" => "法语",
        "de" => "德语",
        _ => "未知语言",
    }.to_string()
}
```

**Step 2: 实现 Ollama 引擎**

创建 `src-tauri/src/translation/ollama.rs`:
```rust
use super::{TranslationRequest, TranslationResponse, build_translation_prompt};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
}

#[derive(Debug, Deserialize)]
struct OllamaResponse {
    response: String,
}

pub async fn translate(
    client: &Client,
    endpoint: &str,
    model: &str,
    request: &TranslationRequest,
) -> Result<TranslationResponse, String> {
    let prompt = build_translation_prompt(&request.text, &request.source_lang, &request.target_lang);

    let ollama_request = OllamaRequest {
        model: model.to_string(),
        prompt,
        stream: false,
    };

    let url = format!("{}/api/generate", endpoint.trim_end_matches('/'));

    let response = client
        .post(&url)
        .json(&ollama_request)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Ollama 返回错误: {}", response.status()));
    }

    let ollama_response: OllamaResponse = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    Ok(TranslationResponse {
        translated_text: ollama_response.response.trim().to_string(),
        detected_lang: None,
    })
}

pub async fn test_connection(client: &Client, endpoint: &str) -> Result<bool, String> {
    let url = format!("{}/api/tags", endpoint.trim_end_matches('/'));

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("连接失败: {}", e))?;

    Ok(response.status().is_success())
}
```

**Step 3: 实现 GLM 引擎**

创建 `src-tauri/src/translation/glm.rs`:
```rust
use super::{TranslationRequest, TranslationResponse, build_translation_prompt};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
struct GlmRequest {
    model: String,
    messages: Vec<GlmMessage>,
}

#[derive(Debug, Serialize)]
struct GlmMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct GlmResponse {
    choices: Vec<GlmChoice>,
}

#[derive(Debug, Deserialize)]
struct GlmChoice {
    message: GlmMessageResponse,
}

#[derive(Debug, Deserialize)]
struct GlmMessageResponse {
    content: String,
}

pub async fn translate(
    client: &Client,
    api_key: &str,
    model: &str,
    request: &TranslationRequest,
) -> Result<TranslationResponse, String> {
    let prompt = build_translation_prompt(&request.text, &request.source_lang, &request.target_lang);

    let glm_request = GlmRequest {
        model: model.to_string(),
        messages: vec![GlmMessage {
            role: "user".to_string(),
            content: prompt,
        }],
    };

    let response = client
        .post("https://open.bigmodel.cn/api/paas/v4/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&glm_request)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("GLM 返回错误: {} - {}", status, body));
    }

    let glm_response: GlmResponse = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let translated_text = glm_response
        .choices
        .first()
        .map(|c| c.message.content.trim().to_string())
        .unwrap_or_default();

    Ok(TranslationResponse {
        translated_text,
        detected_lang: None,
    })
}

pub async fn test_connection(client: &Client, api_key: &str) -> Result<bool, String> {
    // 发送一个简单的测试请求
    let glm_request = GlmRequest {
        model: "glm-4-flash".to_string(),
        messages: vec![GlmMessage {
            role: "user".to_string(),
            content: "Hi".to_string(),
        }],
    };

    let response = client
        .post("https://open.bigmodel.cn/api/paas/v4/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&glm_request)
        .send()
        .await
        .map_err(|e| format!("连接失败: {}", e))?;

    Ok(response.status().is_success())
}
```

**Step 4: 创建 Tauri 命令**

修改 `src-tauri/src/lib.rs`:
```rust
mod translation;

use reqwest::Client;
use tauri::State;
use std::sync::Arc;
use translation::{TranslationRequest, TranslationResponse, EngineConfig};

pub struct AppState {
    pub client: Arc<Client>,
}

#[tauri::command]
async fn translate(
    state: State<'_, AppState>,
    config: EngineConfig,
    request: TranslationRequest,
) -> Result<TranslationResponse, String> {
    match config.engine_type.as_str() {
        "ollama" => {
            let endpoint = config.endpoint.unwrap_or_else(|| "http://localhost:11434".to_string());
            let model = config.model.unwrap_or_else(|| "qwen2".to_string());
            translation::ollama::translate(&state.client, &endpoint, &model, &request).await
        }
        "glm" => {
            let api_key = config.api_key.ok_or("API Key 未配置")?;
            let model = config.model.unwrap_or_else(|| "glm-4-flash".to_string());
            translation::glm::translate(&state.client, &api_key, &model, &request).await
        }
        _ => Err("不支持的翻译引擎".to_string()),
    }
}

#[tauri::command]
async fn test_engine_connection(
    state: State<'_, AppState>,
    config: EngineConfig,
) -> Result<bool, String> {
    match config.engine_type.as_str() {
        "ollama" => {
            let endpoint = config.endpoint.unwrap_or_else(|| "http://localhost:11434".to_string());
            translation::ollama::test_connection(&state.client, &endpoint).await
        }
        "glm" => {
            let api_key = config.api_key.ok_or("API Key 未配置")?;
            translation::glm::test_connection(&state.client, &api_key).await
        }
        _ => Err("不支持的翻译引擎".to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let client = Arc::new(Client::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState { client })
        .invoke_handler(tauri::generate_handler![translate, test_engine_connection])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 5: 更新 main.rs**

修改 `src-tauri/src/main.rs`:
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ttime_lib::run()
}
```

**Step 6: 验证编译通过**

Run:
```bash
cd src-tauri && cargo check
```

Expected: 编译成功，无错误

**Step 7: Commit**

```bash
git add .
git commit -m "feat: implement Ollama and GLM translation engines in Rust"
```

---

### Task 6: 前端集成翻译 API

**Files:**
- Create: `src/services/translation.ts`
- Create: `src/stores/settingsStore.ts`
- Modify: `src/pages/TranslatePage.tsx`

**Step 1: 创建翻译服务**

创建 `src/services/translation.ts`:
```typescript
import { invoke } from '@tauri-apps/api/core';

export interface TranslationRequest {
  text: string;
  source_lang: string;
  target_lang: string;
}

export interface TranslationResponse {
  translated_text: string;
  detected_lang: string | null;
}

export interface EngineConfig {
  engine_type: 'ollama' | 'glm';
  endpoint?: string;
  model?: string;
  api_key?: string;
}

export async function translate(
  config: EngineConfig,
  request: TranslationRequest
): Promise<TranslationResponse> {
  return invoke<TranslationResponse>('translate', { config, request });
}

export async function testEngineConnection(config: EngineConfig): Promise<boolean> {
  return invoke<boolean>('test_engine_connection', { config });
}
```

**Step 2: 创建设置状态管理**

创建 `src/stores/settingsStore.ts`:
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EngineConfig } from '../services/translation';

interface SettingsState {
  // 翻译引擎配置
  engines: EngineConfig[];
  defaultEngineIndex: number;

  // 语言设置
  defaultSourceLang: string;
  defaultTargetLang: string;

  // 主题
  theme: 'light' | 'dark' | 'system';

  // Actions
  addEngine: (engine: EngineConfig) => void;
  removeEngine: (index: number) => void;
  updateEngine: (index: number, engine: EngineConfig) => void;
  setDefaultEngine: (index: number) => void;
  setDefaultLanguages: (source: string, target: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  getDefaultEngine: () => EngineConfig | null;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      engines: [
        {
          engine_type: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'qwen2',
        },
      ],
      defaultEngineIndex: 0,
      defaultSourceLang: 'auto',
      defaultTargetLang: 'zh',
      theme: 'system',

      addEngine: (engine) =>
        set((state) => ({ engines: [...state.engines, engine] })),

      removeEngine: (index) =>
        set((state) => ({
          engines: state.engines.filter((_, i) => i !== index),
          defaultEngineIndex:
            state.defaultEngineIndex >= index
              ? Math.max(0, state.defaultEngineIndex - 1)
              : state.defaultEngineIndex,
        })),

      updateEngine: (index, engine) =>
        set((state) => ({
          engines: state.engines.map((e, i) => (i === index ? engine : e)),
        })),

      setDefaultEngine: (index) => set({ defaultEngineIndex: index }),

      setDefaultLanguages: (source, target) =>
        set({ defaultSourceLang: source, defaultTargetLang: target }),

      setTheme: (theme) => set({ theme }),

      getDefaultEngine: () => {
        const state = get();
        return state.engines[state.defaultEngineIndex] || null;
      },
    }),
    {
      name: 'ttime-settings',
    }
  )
);
```

**Step 3: 更新翻译页面**

修改 `src/pages/TranslatePage.tsx`:
```tsx
import { useState } from 'react';
import { TextArea } from '../components/TextArea';
import { LanguageSelector } from '../components/LanguageSelector';
import { translate } from '../services/translation';
import { useSettingsStore } from '../stores/settingsStore';

export function TranslatePage() {
  const { defaultSourceLang, defaultTargetLang, getDefaultEngine } = useSettingsStore();

  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [sourceLang, setSourceLang] = useState(defaultSourceLang);
  const [targetLang, setTargetLang] = useState(defaultTargetLang);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;

    const engine = getDefaultEngine();
    if (!engine) {
      setError('请先配置翻译引擎');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await translate(engine, {
        text: sourceText,
        source_lang: sourceLang,
        target_lang: targetLang,
      });
      setTargetText(response.translated_text);
    } catch (e) {
      setError(e as string);
      setTargetText('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto') return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(targetText);
    setTargetText(sourceText);
  };

  const handleCopy = async () => {
    if (targetText) {
      await navigator.clipboard.writeText(targetText);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* 语言选择栏 */}
      <div className="flex items-center gap-2">
        <LanguageSelector value={sourceLang} onChange={setSourceLang} showAuto />
        <button
          onClick={handleSwapLanguages}
          disabled={sourceLang === 'auto'}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </button>
        <LanguageSelector value={targetLang} onChange={setTargetLang} showAuto={false} />
      </div>

      {/* 输入区域 */}
      <TextArea
        value={sourceText}
        onChange={setSourceText}
        placeholder="输入要翻译的文本..."
        className="flex-1"
      />

      {/* 翻译按钮 */}
      <button
        onClick={handleTranslate}
        disabled={!sourceText.trim() || isLoading}
        className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg font-medium
                   hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-opacity"
      >
        {isLoading ? '翻译中...' : '翻译'}
      </button>

      {/* 错误提示 */}
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 结果区域 */}
      <div className="flex-1 relative">
        <TextArea
          value={targetText}
          onChange={setTargetText}
          placeholder="翻译结果"
          readOnly
          className="h-full"
        />
        {targetText && (
          <div className="absolute bottom-2 right-2 flex gap-1">
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg bg-[var(--bg-primary)] hover:bg-black/10 dark:hover:bg-white/10"
              title="复制"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: 验证翻译功能**

Run:
```bash
npm run tauri dev
```

Expected: 输入文本后点击翻译按钮，调用 Ollama/GLM 进行翻译

**Step 5: Commit**

```bash
git add .
git commit -m "feat: integrate translation API with frontend"
```

---

## Phase 4: 数据存储模块

### Task 7: 实现 SQLite 数据库

**Files:**
- Create: `src/services/database.ts`
- Create: `src/stores/historyStore.ts`
- Create: `src/pages/HistoryPage.tsx`
- Modify: `src/App.tsx`

**Step 1: 创建数据库服务**

创建 `src/services/database.ts`:
```typescript
import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

export async function initDatabase(): Promise<void> {
  db = await Database.load('sqlite:ttime.db');

  // 创建历史记录表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_text TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      source_lang VARCHAR(10),
      target_lang VARCHAR(10),
      engine VARCHAR(50),
      is_favorite INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建全文搜索虚拟表
  await db.execute(`
    CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(
      source_text,
      translated_text,
      content='history',
      content_rowid='id'
    )
  `);

  // 创建触发器以同步 FTS 表
  await db.execute(`
    CREATE TRIGGER IF NOT EXISTS history_ai AFTER INSERT ON history BEGIN
      INSERT INTO history_fts(rowid, source_text, translated_text)
      VALUES (new.id, new.source_text, new.translated_text);
    END
  `);

  await db.execute(`
    CREATE TRIGGER IF NOT EXISTS history_ad AFTER DELETE ON history BEGIN
      INSERT INTO history_fts(history_fts, rowid, source_text, translated_text)
      VALUES('delete', old.id, old.source_text, old.translated_text);
    END
  `);
}

export interface HistoryRecord {
  id: number;
  source_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  engine: string;
  is_favorite: boolean;
  created_at: string;
}

export async function addHistory(record: Omit<HistoryRecord, 'id' | 'created_at' | 'is_favorite'>): Promise<number> {
  if (!db) throw new Error('Database not initialized');

  const result = await db.execute(
    `INSERT INTO history (source_text, translated_text, source_lang, target_lang, engine)
     VALUES ($1, $2, $3, $4, $5)`,
    [record.source_text, record.translated_text, record.source_lang, record.target_lang, record.engine]
  );

  return result.lastInsertId;
}

export async function getHistory(limit = 100, offset = 0): Promise<HistoryRecord[]> {
  if (!db) throw new Error('Database not initialized');

  const results = await db.select<HistoryRecord[]>(
    `SELECT id, source_text, translated_text, source_lang, target_lang, engine,
            is_favorite, created_at
     FROM history
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return results.map(r => ({ ...r, is_favorite: Boolean(r.is_favorite) }));
}

export async function searchHistory(query: string): Promise<HistoryRecord[]> {
  if (!db) throw new Error('Database not initialized');

  const results = await db.select<HistoryRecord[]>(
    `SELECT h.id, h.source_text, h.translated_text, h.source_lang, h.target_lang,
            h.engine, h.is_favorite, h.created_at
     FROM history h
     JOIN history_fts fts ON h.id = fts.rowid
     WHERE history_fts MATCH $1
     ORDER BY h.created_at DESC
     LIMIT 100`,
    [query + '*']
  );

  return results.map(r => ({ ...r, is_favorite: Boolean(r.is_favorite) }));
}

export async function toggleFavorite(id: number): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.execute(
    `UPDATE history SET is_favorite = NOT is_favorite WHERE id = $1`,
    [id]
  );
}

export async function getFavorites(): Promise<HistoryRecord[]> {
  if (!db) throw new Error('Database not initialized');

  const results = await db.select<HistoryRecord[]>(
    `SELECT id, source_text, translated_text, source_lang, target_lang, engine,
            is_favorite, created_at
     FROM history
     WHERE is_favorite = 1
     ORDER BY created_at DESC`,
    []
  );

  return results.map(r => ({ ...r, is_favorite: true }));
}

export async function deleteHistory(id: number): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.execute(`DELETE FROM history WHERE id = $1`, [id]);
}

export async function clearHistory(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.execute(`DELETE FROM history`);
  await db.execute(`DELETE FROM history_fts`);
}
```

**Step 2: 创建历史记录状态管理**

创建 `src/stores/historyStore.ts`:
```typescript
import { create } from 'zustand';
import {
  HistoryRecord,
  getHistory,
  searchHistory,
  toggleFavorite,
  getFavorites,
  deleteHistory,
  addHistory,
} from '../services/database';

interface HistoryState {
  records: HistoryRecord[];
  isLoading: boolean;
  searchQuery: string;
  showFavoritesOnly: boolean;

  // Actions
  loadHistory: () => Promise<void>;
  search: (query: string) => Promise<void>;
  toggleShowFavorites: () => Promise<void>;
  addRecord: (record: Omit<HistoryRecord, 'id' | 'created_at' | 'is_favorite'>) => Promise<void>;
  toggleRecordFavorite: (id: number) => Promise<void>;
  deleteRecord: (id: number) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  records: [],
  isLoading: false,
  searchQuery: '',
  showFavoritesOnly: false,

  loadHistory: async () => {
    set({ isLoading: true });
    try {
      const records = await getHistory();
      set({ records });
    } finally {
      set({ isLoading: false });
    }
  },

  search: async (query: string) => {
    set({ searchQuery: query, isLoading: true });
    try {
      const records = query ? await searchHistory(query) : await getHistory();
      set({ records });
    } finally {
      set({ isLoading: false });
    }
  },

  toggleShowFavorites: async () => {
    const { showFavoritesOnly } = get();
    set({ showFavoritesOnly: !showFavoritesOnly, isLoading: true });
    try {
      const records = !showFavoritesOnly ? await getFavorites() : await getHistory();
      set({ records });
    } finally {
      set({ isLoading: false });
    }
  },

  addRecord: async (record) => {
    await addHistory(record);
    const { searchQuery, showFavoritesOnly } = get();
    if (!searchQuery && !showFavoritesOnly) {
      const records = await getHistory();
      set({ records });
    }
  },

  toggleRecordFavorite: async (id: number) => {
    await toggleFavorite(id);
    set((state) => ({
      records: state.records.map((r) =>
        r.id === id ? { ...r, is_favorite: !r.is_favorite } : r
      ),
    }));
  },

  deleteRecord: async (id: number) => {
    await deleteHistory(id);
    set((state) => ({
      records: state.records.filter((r) => r.id !== id),
    }));
  },
}));
```

**Step 3: 创建历史页面**

创建 `src/pages/HistoryPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useHistoryStore } from '../stores/historyStore';

export function HistoryPage() {
  const {
    records,
    isLoading,
    searchQuery,
    showFavoritesOnly,
    loadHistory,
    search,
    toggleShowFavorites,
    toggleRecordFavorite,
    deleteRecord,
  } = useHistoryStore();

  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search(localSearch);
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* 搜索栏 */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="搜索历史记录..."
          className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] rounded-lg border border-transparent
                     focus:border-[var(--accent)] focus:outline-none"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90"
        >
          搜索
        </button>
        <button
          type="button"
          onClick={toggleShowFavorites}
          className={`px-4 py-2 rounded-lg border ${
            showFavoritesOnly
              ? 'bg-yellow-500 text-white border-yellow-500'
              : 'border-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
          }`}
        >
          收藏
        </button>
      </form>

      {/* 历史列表 */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="text-center text-[var(--text-secondary)] py-8">加载中...</div>
        ) : records.length === 0 ? (
          <div className="text-center text-[var(--text-secondary)] py-8">
            {searchQuery ? '未找到匹配的记录' : '暂无历史记录'}
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <div
                key={record.id}
                className="p-4 bg-[var(--bg-secondary)] rounded-lg"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-[var(--text-secondary)]">
                    {record.source_lang} → {record.target_lang} · {record.engine}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {new Date(record.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm mb-2">{record.source_text}</div>
                <div className="text-sm text-[var(--accent)] mb-3">{record.translated_text}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(record.translated_text)}
                    className="text-xs px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    复制译文
                  </button>
                  <button
                    onClick={() => toggleRecordFavorite(record.id)}
                    className={`text-xs px-2 py-1 rounded ${
                      record.is_favorite
                        ? 'text-yellow-500'
                        : 'hover:bg-black/10 dark:hover:bg-white/10'
                    }`}
                  >
                    {record.is_favorite ? '取消收藏' : '收藏'}
                  </button>
                  <button
                    onClick={() => deleteRecord(record.id)}
                    className="text-xs px-2 py-1 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: 更新 App.tsx 初始化数据库**

修改 `src/App.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { TranslatePage } from './pages/TranslatePage';
import { HistoryPage } from './pages/HistoryPage';
import { initDatabase } from './services/database';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    initDatabase().then(() => setIsDbReady(true));
  }, []);

  if (!isDbReady) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">初始化中...</div>
      </div>
    );
  }

  return (
    <Layout>
      {(activeTab) => (
        <div className="h-full">
          {activeTab === 'translate' && <TranslatePage />}
          {activeTab === 'history' && <HistoryPage />}
          {activeTab === 'settings' && <div>设置页面</div>}
        </div>
      )}
    </Layout>
  );
}

export default App;
```

**Step 5: 更新翻译页面保存历史**

修改 `src/pages/TranslatePage.tsx` 的 `handleTranslate` 函数:
```tsx
// 在文件顶部添加导入
import { useHistoryStore } from '../stores/historyStore';

// 在组件内添加
const { addRecord } = useHistoryStore();

// 修改 handleTranslate 函数
const handleTranslate = async () => {
  if (!sourceText.trim()) return;

  const engine = getDefaultEngine();
  if (!engine) {
    setError('请先配置翻译引擎');
    return;
  }

  setIsLoading(true);
  setError(null);

  try {
    const response = await translate(engine, {
      text: sourceText,
      source_lang: sourceLang,
      target_lang: targetLang,
    });
    setTargetText(response.translated_text);

    // 保存到历史记录
    await addRecord({
      source_text: sourceText,
      translated_text: response.translated_text,
      source_lang: sourceLang,
      target_lang: targetLang,
      engine: engine.engine_type,
    });
  } catch (e) {
    setError(e as string);
    setTargetText('');
  } finally {
    setIsLoading(false);
  }
};
```

**Step 6: 验证历史功能**

Run:
```bash
npm run tauri dev
```

Expected: 翻译后记录保存到历史，历史页面可以搜索、收藏、删除

**Step 7: Commit**

```bash
git add .
git commit -m "feat: implement SQLite history storage with search and favorites"
```

---

## Phase 5: 设置页面

### Task 8: 实现设置页面

**Files:**
- Create: `src/pages/SettingsPage.tsx`
- Create: `src/components/EngineSettings.tsx`
- Modify: `src/App.tsx`

**Step 1: 创建引擎设置组件**

创建 `src/components/EngineSettings.tsx`:
```tsx
import { useState } from 'react';
import { EngineConfig, testEngineConnection } from '../services/translation';

interface EngineSettingsProps {
  engine: EngineConfig;
  isDefault: boolean;
  onUpdate: (engine: EngineConfig) => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

export function EngineSettings({
  engine,
  isDefault,
  onUpdate,
  onDelete,
  onSetDefault,
}: EngineSettingsProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testEngineConnection(engine);
      setTestResult(result);
    } catch {
      setTestResult(false);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <span className="font-medium">
          {engine.engine_type === 'ollama' ? 'Ollama' : '智谱 GLM'}
          {isDefault && (
            <span className="ml-2 text-xs px-2 py-0.5 bg-[var(--accent)] text-white rounded">
              默认
            </span>
          )}
        </span>
        <div className="flex gap-2">
          {!isDefault && (
            <button
              onClick={onSetDefault}
              className="text-xs px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
            >
              设为默认
            </button>
          )}
          <button
            onClick={onDelete}
            className="text-xs px-2 py-1 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
          >
            删除
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {engine.engine_type === 'ollama' ? (
          <>
            <div>
              <label className="text-sm text-[var(--text-secondary)] block mb-1">
                服务地址
              </label>
              <input
                type="text"
                value={engine.endpoint || ''}
                onChange={(e) => onUpdate({ ...engine, endpoint: e.target.value })}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 bg-[var(--bg-primary)] rounded-lg border border-transparent
                           focus:border-[var(--accent)] focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] block mb-1">
                模型名称
              </label>
              <input
                type="text"
                value={engine.model || ''}
                onChange={(e) => onUpdate({ ...engine, model: e.target.value })}
                placeholder="qwen2"
                className="w-full px-3 py-2 bg-[var(--bg-primary)] rounded-lg border border-transparent
                           focus:border-[var(--accent)] focus:outline-none text-sm"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="text-sm text-[var(--text-secondary)] block mb-1">
                API Key
              </label>
              <input
                type="password"
                value={engine.api_key || ''}
                onChange={(e) => onUpdate({ ...engine, api_key: e.target.value })}
                placeholder="输入 API Key"
                className="w-full px-3 py-2 bg-[var(--bg-primary)] rounded-lg border border-transparent
                           focus:border-[var(--accent)] focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] block mb-1">
                模型
              </label>
              <select
                value={engine.model || 'glm-4-flash'}
                onChange={(e) => onUpdate({ ...engine, model: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] rounded-lg border border-transparent
                           focus:border-[var(--accent)] focus:outline-none text-sm"
              >
                <option value="glm-4-flash">GLM-4-Flash (快速)</option>
                <option value="glm-4">GLM-4 (标准)</option>
                <option value="glm-4-plus">GLM-4-Plus (增强)</option>
              </select>
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleTest}
            disabled={isTesting}
            className="px-3 py-1.5 text-sm bg-[var(--bg-primary)] rounded-lg
                       hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50"
          >
            {isTesting ? '测试中...' : '测试连接'}
          </button>
          {testResult !== null && (
            <span className={`text-sm ${testResult ? 'text-green-500' : 'text-red-500'}`}>
              {testResult ? '连接成功' : '连接失败'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: 创建设置页面**

创建 `src/pages/SettingsPage.tsx`:
```tsx
import { useSettingsStore } from '../stores/settingsStore';
import { EngineSettings } from '../components/EngineSettings';
import { LanguageSelector } from '../components/LanguageSelector';
import { clearHistory } from '../services/database';
import { useState } from 'react';

export function SettingsPage() {
  const {
    engines,
    defaultEngineIndex,
    defaultSourceLang,
    defaultTargetLang,
    theme,
    addEngine,
    removeEngine,
    updateEngine,
    setDefaultEngine,
    setDefaultLanguages,
    setTheme,
  } = useSettingsStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleAddOllama = () => {
    addEngine({
      engine_type: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'qwen2',
    });
  };

  const handleAddGlm = () => {
    addEngine({
      engine_type: 'glm',
      model: 'glm-4-flash',
      api_key: '',
    });
  };

  const handleClearHistory = async () => {
    await clearHistory();
    setShowClearConfirm(false);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl space-y-6">
        {/* 翻译引擎 */}
        <section>
          <h2 className="text-lg font-medium mb-4">翻译引擎</h2>
          <div className="space-y-3">
            {engines.map((engine, index) => (
              <EngineSettings
                key={index}
                engine={engine}
                isDefault={index === defaultEngineIndex}
                onUpdate={(updated) => updateEngine(index, updated)}
                onDelete={() => removeEngine(index)}
                onSetDefault={() => setDefaultEngine(index)}
              />
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAddOllama}
              className="px-4 py-2 text-sm bg-[var(--bg-secondary)] rounded-lg
                         hover:bg-black/10 dark:hover:bg-white/10"
            >
              + 添加 Ollama
            </button>
            <button
              onClick={handleAddGlm}
              className="px-4 py-2 text-sm bg-[var(--bg-secondary)] rounded-lg
                         hover:bg-black/10 dark:hover:bg-white/10"
            >
              + 添加 GLM
            </button>
          </div>
        </section>

        {/* 语言设置 */}
        <section>
          <h2 className="text-lg font-medium mb-4">默认语言</h2>
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm text-[var(--text-secondary)] block mb-1">
                源语言
              </label>
              <LanguageSelector
                value={defaultSourceLang}
                onChange={(lang) => setDefaultLanguages(lang, defaultTargetLang)}
                showAuto
              />
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] block mb-1">
                目标语言
              </label>
              <LanguageSelector
                value={defaultTargetLang}
                onChange={(lang) => setDefaultLanguages(defaultSourceLang, lang)}
                showAuto={false}
              />
            </div>
          </div>
        </section>

        {/* 主题设置 */}
        <section>
          <h2 className="text-lg font-medium mb-4">外观</h2>
          <div className="flex gap-2">
            {[
              { value: 'light', label: '浅色' },
              { value: 'dark', label: '深色' },
              { value: 'system', label: '跟随系统' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value as 'light' | 'dark' | 'system')}
                className={`px-4 py-2 text-sm rounded-lg ${
                  theme === option.value
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-secondary)] hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        {/* 数据管理 */}
        <section>
          <h2 className="text-lg font-medium mb-4">数据管理</h2>
          {showClearConfirm ? (
            <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                确定要清空所有历史记录吗？此操作不可恢复。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleClearHistory}
                  className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  确定清空
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 text-sm bg-[var(--bg-secondary)] rounded-lg"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-4 py-2 text-sm text-red-500 bg-[var(--bg-secondary)] rounded-lg
                         hover:bg-red-100 dark:hover:bg-red-900/30"
            >
              清空历史记录
            </button>
          )}
        </section>

        {/* 关于 */}
        <section>
          <h2 className="text-lg font-medium mb-4">关于</h2>
          <div className="text-sm text-[var(--text-secondary)]">
            <p>TTime v0.1.0</p>
            <p>简洁高效的跨平台翻译软件</p>
          </div>
        </section>
      </div>
    </div>
  );
}
```

**Step 3: 更新 App.tsx**

修改 `src/App.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { TranslatePage } from './pages/TranslatePage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { initDatabase } from './services/database';
import { useSettingsStore } from './stores/settingsStore';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const { theme } = useSettingsStore();

  useEffect(() => {
    initDatabase().then(() => setIsDbReady(true));
  }, []);

  // 应用主题
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', isDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  if (!isDbReady) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">初始化中...</div>
      </div>
    );
  }

  return (
    <Layout>
      {(activeTab) => (
        <div className="h-full">
          {activeTab === 'translate' && <TranslatePage />}
          {activeTab === 'history' && <HistoryPage />}
          {activeTab === 'settings' && <SettingsPage />}
        </div>
      )}
    </Layout>
  );
}

export default App;
```

**Step 4: 验证设置页面**

Run:
```bash
npm run tauri dev
```

Expected: 设置页面可以配置引擎、语言、主题，测试连接正常工作

**Step 5: Commit**

```bash
git add .
git commit -m "feat: implement settings page with engine config and theme switching"
```

---

## Phase 6: 系统集成

### Task 9: 实现系统托盘

**Files:**
- Create: `src-tauri/src/tray.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/icons/icon.png`

**Step 1: 创建托盘图标**

需要在 `src-tauri/icons/` 目录下准备一个 PNG 图标文件（32x32 像素）。

**Step 2: 创建托盘模块**

创建 `src-tauri/src/tray.rs`:
```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};

pub fn create_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
```

**Step 3: 更新 lib.rs**

修改 `src-tauri/src/lib.rs` 添加托盘初始化:
```rust
mod translation;
mod tray;

use reqwest::Client;
use tauri::{Manager, State};
use std::sync::Arc;
use translation::{TranslationRequest, TranslationResponse, EngineConfig};

pub struct AppState {
    pub client: Arc<Client>,
}

#[tauri::command]
async fn translate(
    state: State<'_, AppState>,
    config: EngineConfig,
    request: TranslationRequest,
) -> Result<TranslationResponse, String> {
    match config.engine_type.as_str() {
        "ollama" => {
            let endpoint = config.endpoint.unwrap_or_else(|| "http://localhost:11434".to_string());
            let model = config.model.unwrap_or_else(|| "qwen2".to_string());
            translation::ollama::translate(&state.client, &endpoint, &model, &request).await
        }
        "glm" => {
            let api_key = config.api_key.ok_or("API Key 未配置")?;
            let model = config.model.unwrap_or_else(|| "glm-4-flash".to_string());
            translation::glm::translate(&state.client, &api_key, &model, &request).await
        }
        _ => Err("不支持的翻译引擎".to_string()),
    }
}

#[tauri::command]
async fn test_engine_connection(
    state: State<'_, AppState>,
    config: EngineConfig,
) -> Result<bool, String> {
    match config.engine_type.as_str() {
        "ollama" => {
            let endpoint = config.endpoint.unwrap_or_else(|| "http://localhost:11434".to_string());
            translation::ollama::test_connection(&state.client, &endpoint).await
        }
        "glm" => {
            let api_key = config.api_key.ok_or("API Key 未配置")?;
            translation::glm::test_connection(&state.client, &api_key).await
        }
        _ => Err("不支持的翻译引擎".to_string()),
    }
}

#[tauri::command]
async fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let client = Arc::new(Client::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState { client })
        .setup(|app| {
            // 创建系统托盘
            tray::create_tray(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![translate, test_engine_connection, show_main_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 4: 验证托盘功能**

Run:
```bash
npm run tauri dev
```

Expected: 系统托盘图标显示，左键点击切换窗口显示/隐藏，右键显示菜单

**Step 5: Commit**

```bash
git add .
git commit -m "feat: implement system tray with show/hide toggle"
```

---

### Task 10: 实现全局快捷键和划词翻译

**Files:**
- Create: `src-tauri/src/shortcut.rs`
- Create: `src-tauri/src/clipboard.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`

**Step 1: 添加 enigo 依赖**

修改 `src-tauri/Cargo.toml`:
```toml
[dependencies]
# ... 其他依赖
enigo = "0.2"
```

**Step 2: 创建剪贴板模块**

创建 `src-tauri/src/clipboard.rs`:
```rust
use enigo::{Enigo, Key, KeyboardControllable};
use std::thread;
use std::time::Duration;
use tauri_plugin_clipboard_manager::ClipboardExt;

pub async fn get_selected_text(app: &tauri::AppHandle) -> Result<String, String> {
    // 保存当前剪贴板内容
    let original_clipboard = app
        .clipboard()
        .read_text()
        .unwrap_or_default();

    // 模拟 Ctrl+C / Cmd+C
    let mut enigo = Enigo::new();

    #[cfg(target_os = "macos")]
    {
        enigo.key_down(Key::Meta);
        enigo.key_click(Key::Layout('c'));
        enigo.key_up(Key::Meta);
    }

    #[cfg(target_os = "windows")]
    {
        enigo.key_down(Key::Control);
        enigo.key_click(Key::Layout('c'));
        enigo.key_up(Key::Control);
    }

    // 等待复制完成
    thread::sleep(Duration::from_millis(100));

    // 读取选中的文本
    let selected_text = app
        .clipboard()
        .read_text()
        .map_err(|e| format!("读取剪贴板失败: {}", e))?
        .unwrap_or_default();

    // 恢复原来的剪贴板内容
    if let Some(original) = original_clipboard {
        let _ = app.clipboard().write_text(original);
    }

    if selected_text.trim().is_empty() {
        return Err("未选中任何文本".to_string());
    }

    Ok(selected_text)
}
```

**Step 3: 创建快捷键模块**

创建 `src-tauri/src/shortcut.rs`:
```rust
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

use crate::clipboard::get_selected_text;

pub fn register_shortcuts(app: &AppHandle) -> Result<(), String> {
    let app_handle = app.clone();

    // 划词翻译快捷键: Cmd/Ctrl + Shift + T
    #[cfg(target_os = "macos")]
    let translate_shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyT);
    #[cfg(target_os = "windows")]
    let translate_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyT);

    app.global_shortcut()
        .on_shortcut(translate_shortcut, move |_app, _shortcut, _event| {
            let app = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(text) = get_selected_text(&app).await {
                    // 发送到前端进行翻译
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("translate-selection", text);
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });
        })
        .map_err(|e| format!("注册快捷键失败: {}", e))?;

    // 显示主窗口快捷键: Cmd/Ctrl + Shift + Space
    let app_handle2 = app.clone();
    #[cfg(target_os = "macos")]
    let show_shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space);
    #[cfg(target_os = "windows")]
    let show_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);

    app.global_shortcut()
        .on_shortcut(show_shortcut, move |_app, _shortcut, _event| {
            if let Some(window) = app_handle2.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        })
        .map_err(|e| format!("注册快捷键失败: {}", e))?;

    Ok(())
}
```

**Step 4: 更新 lib.rs 注册快捷键**

修改 `src-tauri/src/lib.rs` 的 setup 部分:
```rust
mod translation;
mod tray;
mod shortcut;
mod clipboard;

// ... 其他代码保持不变 ...

.setup(|app| {
    // 创建系统托盘
    tray::create_tray(app.handle())?;

    // 注册全局快捷键
    shortcut::register_shortcuts(app.handle())
        .map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)))?;

    Ok(())
})
```

**Step 5: 前端监听翻译事件**

修改 `src/pages/TranslatePage.tsx`:
```tsx
import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
// ... 其他导入

export function TranslatePage() {
  // ... 现有状态

  // 监听划词翻译事件
  useEffect(() => {
    const unlisten = listen<string>('translate-selection', async (event) => {
      setSourceText(event.payload);
      // 自动翻译
      const engine = getDefaultEngine();
      if (engine && event.payload.trim()) {
        setIsLoading(true);
        setError(null);
        try {
          const response = await translate(engine, {
            text: event.payload,
            source_lang: sourceLang,
            target_lang: targetLang,
          });
          setTargetText(response.translated_text);
          await addRecord({
            source_text: event.payload,
            translated_text: response.translated_text,
            source_lang: sourceLang,
            target_lang: targetLang,
            engine: engine.engine_type,
          });
        } catch (e) {
          setError(e as string);
        } finally {
          setIsLoading(false);
        }
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [sourceLang, targetLang]);

  // ... 其余代码
}
```

**Step 6: 验证快捷键功能**

Run:
```bash
npm run tauri dev
```

Expected: 按 Cmd/Ctrl+Shift+T 可以翻译选中文本，按 Cmd/Ctrl+Shift+Space 可以显示主窗口

**Step 7: Commit**

```bash
git add .
git commit -m "feat: implement global shortcuts for text selection translation"
```

---

## Phase 7: 截图翻译（可选，较复杂）

### Task 11: 实现截图功能

此任务较为复杂，涉及截图 UI、OCR 集成，建议作为后续迭代实现。

主要步骤：
1. 创建全屏截图覆盖窗口
2. 实现拖拽选区功能
3. 截取选定区域图像
4. 集成 Tesseract OCR
5. 将识别文本发送到翻译页面

---

## 总结

完成以上任务后，TTime 将具备以下核心功能：

- [x] Tauri + React + TypeScript 项目架构
- [x] 简约现代 UI（深浅色主题）
- [x] 输入翻译功能
- [x] Ollama 和 GLM 翻译引擎支持
- [x] SQLite 历史记录（搜索、收藏）
- [x] 设置页面（引擎配置、语言、主题）
- [x] 系统托盘
- [x] 划词翻译（快捷键触发）
- [ ] 截图翻译（后续迭代）

**预计任务数：10 个主要任务，约 60-80 个细分步骤**
