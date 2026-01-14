# 自定义快捷键实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 允许用户自定义划词翻译和显示主窗口的快捷键

**Architecture:** 前端 settingsStore 存储快捷键配置，通过 Tauri 命令传递给 Rust 后端动态注册。新建 ShortcutInput 组件处理键盘录入。

**Tech Stack:** React, Zustand, Tauri 2.0, tauri-plugin-global-shortcut

---

## Task 1: 扩展 settingsStore 添加快捷键配置

**Files:**
- Modify: `src/stores/settingsStore.ts`

**Step 1: 添加 ShortcutConfig 类型和状态**

在 `SettingsState` 接口中添加：

```typescript
interface ShortcutConfig {
  translate: string;
  showWindow: string;
}

interface SettingsState {
  // ... 现有字段
  shortcuts: ShortcutConfig;

  // ... 现有方法
  setShortcut: (key: keyof ShortcutConfig, value: string) => void;
  resetShortcuts: () => void;
}
```

**Step 2: 添加默认值和方法实现**

在 store 中添加：

```typescript
const DEFAULT_SHORTCUTS: ShortcutConfig = {
  translate: 'CommandOrControl+Shift+T',
  showWindow: 'CommandOrControl+Shift+Space',
};

// 在 create 中添加:
shortcuts: DEFAULT_SHORTCUTS,

setShortcut: (key, value) =>
  set((state) => ({
    shortcuts: { ...state.shortcuts, [key]: value },
  })),

resetShortcuts: () => set({ shortcuts: DEFAULT_SHORTCUTS }),
```

**Step 3: 验证**

Run: `npm run tauri dev`
Expected: 应用正常启动，无 TypeScript 错误

**Step 4: Commit**

```bash
git add src/stores/settingsStore.ts
git commit -m "feat: add shortcuts config to settings store"
```

---

## Task 2: 创建 ShortcutInput 组件

**Files:**
- Create: `src/components/ShortcutInput.tsx`

**Step 1: 创建组件文件**

```tsx
import { useState, useRef, useEffect } from 'react';

interface ShortcutInputProps {
  value: string;
  onChange: (value: string) => void;
  onReset: () => void;
  otherShortcut?: string;
  defaultValue: string;
}

// 解析快捷键字符串为显示格式
function formatShortcut(shortcut: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return shortcut
    .replace('CommandOrControl', isMac ? '⌘' : 'Ctrl')
    .replace('Shift', isMac ? '⇧' : 'Shift')
    .replace('Alt', isMac ? '⌥' : 'Alt')
    .replace(/\+/g, ' ');
}

// 将键盘事件转换为快捷键字符串
function eventToShortcut(e: KeyboardEvent): string | null {
  // 忽略单独的修饰键
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    return null;
  }

  const parts: string[] = [];

  if (e.metaKey || e.ctrlKey) {
    parts.push('CommandOrControl');
  }
  if (e.shiftKey) {
    parts.push('Shift');
  }
  if (e.altKey) {
    parts.push('Alt');
  }

  // 必须有修饰键
  if (parts.length === 0) {
    return null;
  }

  // 转换主键
  let key = e.key.toUpperCase();
  if (e.code.startsWith('Key')) {
    key = e.code.replace('Key', '');
  } else if (e.code.startsWith('Digit')) {
    key = e.code.replace('Digit', '');
  } else if (e.code === 'Space') {
    key = 'Space';
  } else if (e.code.startsWith('F') && /^F\d+$/.test(e.code)) {
    key = e.code;
  } else {
    // 其他特殊键
    const keyMap: Record<string, string> = {
      'ArrowUp': 'Up',
      'ArrowDown': 'Down',
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right',
      'Enter': 'Enter',
      'Tab': 'Tab',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      'Escape': 'Escape',
    };
    key = keyMap[e.key] || e.key.toUpperCase();
  }

  parts.push(key);
  return parts.join('+');
}

// 检查是否为系统保留快捷键
function isReservedShortcut(shortcut: string): boolean {
  const reserved = [
    'CommandOrControl+C',
    'CommandOrControl+V',
    'CommandOrControl+X',
    'CommandOrControl+A',
    'CommandOrControl+Z',
    'CommandOrControl+Q',
    'CommandOrControl+W',
    'CommandOrControl+N',
    'CommandOrControl+O',
    'CommandOrControl+S',
    'CommandOrControl+P',
  ];
  return reserved.includes(shortcut);
}

export function ShortcutInput({ value, onChange, onReset, otherShortcut, defaultValue }: ShortcutInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [tempValue, setTempValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  const displayValue = tempValue ?? value;
  const hasConflict = otherShortcut && displayValue === otherShortcut;
  const isDefault = value === defaultValue;

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Esc 取消录入
      if (e.key === 'Escape') {
        setIsRecording(false);
        setTempValue(null);
        setError(null);
        return;
      }

      const shortcut = eventToShortcut(e);
      if (!shortcut) return;

      // 检查系统保留
      if (isReservedShortcut(shortcut)) {
        setError('此快捷键为系统保留');
        return;
      }

      setError(null);
      setTempValue(shortcut);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // 当释放所有修饰键时，确认录入
      if (tempValue && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      if (tempValue && !isReservedShortcut(tempValue)) {
        onChange(tempValue);
        setIsRecording(false);
        setTempValue(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [isRecording, tempValue, onChange]);

  // 点击外部取消录入
  useEffect(() => {
    if (!isRecording) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsRecording(false);
        setTempValue(null);
        setError(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRecording]);

  return (
    <div className="flex items-center gap-2">
      <div
        ref={inputRef}
        onClick={() => setIsRecording(true)}
        className={`
          px-3 py-2 min-w-[180px] rounded-lg border cursor-pointer
          font-mono text-sm transition-colors
          ${isRecording
            ? 'border-[var(--accent)] bg-[var(--accent)]/10'
            : 'border-[var(--border)] bg-[var(--bg-primary)] hover:border-[var(--accent)]'
          }
          ${hasConflict ? 'border-yellow-500' : ''}
          ${error ? 'border-red-500' : ''}
        `}
      >
        {isRecording ? (
          <span className="text-[var(--text-secondary)]">请按下快捷键...</span>
        ) : (
          formatShortcut(displayValue)
        )}
      </div>

      {!isDefault && (
        <button
          onClick={onReset}
          className="px-2 py-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          重置
        </button>
      )}

      {hasConflict && (
        <span className="text-yellow-500 text-sm">与其他快捷键冲突</span>
      )}
      {error && (
        <span className="text-red-500 text-sm">{error}</span>
      )}
    </div>
  );
}
```

**Step 2: 验证**

Run: `npm run tauri dev`
Expected: 编译成功，无错误

**Step 3: Commit**

```bash
git add src/components/ShortcutInput.tsx
git commit -m "feat: create ShortcutInput component for keyboard recording"
```

---

## Task 3: 在 SettingsPage 添加快捷键设置区域

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

**Step 1: 导入组件和获取 store 状态**

在文件顶部添加导入：
```tsx
import { ShortcutInput } from '../components/ShortcutInput';
```

从 store 中解构新字段：
```tsx
const {
  // ... 现有字段
  shortcuts,
  setShortcut,
  resetShortcuts,
} = useSettingsStore();
```

**Step 2: 添加快捷键设置区域**

在"外观"区域后、"数据管理"区域前添加：

```tsx
{/* 快捷键区域 */}
<section>
  <h2 className="text-lg font-semibold mb-3">快捷键</h2>
  <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] space-y-4">
    <div className="flex items-center justify-between">
      <span className="text-sm">划词翻译</span>
      <ShortcutInput
        value={shortcuts.translate}
        onChange={(v) => setShortcut('translate', v)}
        onReset={() => setShortcut('translate', 'CommandOrControl+Shift+T')}
        otherShortcut={shortcuts.showWindow}
        defaultValue="CommandOrControl+Shift+T"
      />
    </div>
    <div className="flex items-center justify-between">
      <span className="text-sm">显示主窗口</span>
      <ShortcutInput
        value={shortcuts.showWindow}
        onChange={(v) => setShortcut('showWindow', v)}
        onReset={() => setShortcut('showWindow', 'CommandOrControl+Shift+Space')}
        otherShortcut={shortcuts.translate}
        defaultValue="CommandOrControl+Shift+Space"
      />
    </div>
  </div>
</section>
```

**Step 3: 验证**

Run: `npm run tauri dev`
Expected: 设置页面显示快捷键配置区域，可以录入快捷键

**Step 4: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat: add shortcuts settings section to SettingsPage"
```

---

## Task 4: 修改 Rust 后端支持动态快捷键

**Files:**
- Modify: `src-tauri/src/shortcut.rs`

**Step 1: 重写 shortcut.rs 支持动态注册**

```rust
use crate::clipboard::get_selected_text;
use crate::popup;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

// 存储当前注册的快捷键
static CURRENT_SHORTCUTS: Mutex<Option<(Shortcut, Shortcut)>> = Mutex::new(None);

/// 解析快捷键字符串为 Shortcut 对象
fn parse_shortcut(shortcut_str: &str) -> Result<Shortcut, String> {
    let parts: Vec<&str> = shortcut_str.split('+').collect();
    if parts.is_empty() {
        return Err("快捷键格式无效".to_string());
    }

    let mut modifiers = Modifiers::empty();
    let mut key_code: Option<Code> = None;

    for part in parts {
        match part {
            "CommandOrControl" => {
                #[cfg(target_os = "macos")]
                {
                    modifiers |= Modifiers::META;
                }
                #[cfg(target_os = "windows")]
                {
                    modifiers |= Modifiers::CONTROL;
                }
            }
            "Shift" => modifiers |= Modifiers::SHIFT,
            "Alt" => modifiers |= Modifiers::ALT,
            "Control" => modifiers |= Modifiers::CONTROL,
            "Meta" => modifiers |= Modifiers::META,
            key => {
                key_code = Some(match key {
                    // 字母键
                    "A" => Code::KeyA,
                    "B" => Code::KeyB,
                    "C" => Code::KeyC,
                    "D" => Code::KeyD,
                    "E" => Code::KeyE,
                    "F" => Code::KeyF,
                    "G" => Code::KeyG,
                    "H" => Code::KeyH,
                    "I" => Code::KeyI,
                    "J" => Code::KeyJ,
                    "K" => Code::KeyK,
                    "L" => Code::KeyL,
                    "M" => Code::KeyM,
                    "N" => Code::KeyN,
                    "O" => Code::KeyO,
                    "P" => Code::KeyP,
                    "Q" => Code::KeyQ,
                    "R" => Code::KeyR,
                    "S" => Code::KeyS,
                    "T" => Code::KeyT,
                    "U" => Code::KeyU,
                    "V" => Code::KeyV,
                    "W" => Code::KeyW,
                    "X" => Code::KeyX,
                    "Y" => Code::KeyY,
                    "Z" => Code::KeyZ,
                    // 数字键
                    "0" => Code::Digit0,
                    "1" => Code::Digit1,
                    "2" => Code::Digit2,
                    "3" => Code::Digit3,
                    "4" => Code::Digit4,
                    "5" => Code::Digit5,
                    "6" => Code::Digit6,
                    "7" => Code::Digit7,
                    "8" => Code::Digit8,
                    "9" => Code::Digit9,
                    // 功能键
                    "F1" => Code::F1,
                    "F2" => Code::F2,
                    "F3" => Code::F3,
                    "F4" => Code::F4,
                    "F5" => Code::F5,
                    "F6" => Code::F6,
                    "F7" => Code::F7,
                    "F8" => Code::F8,
                    "F9" => Code::F9,
                    "F10" => Code::F10,
                    "F11" => Code::F11,
                    "F12" => Code::F12,
                    // 特殊键
                    "Space" => Code::Space,
                    "Enter" => Code::Enter,
                    "Tab" => Code::Tab,
                    "Backspace" => Code::Backspace,
                    "Delete" => Code::Delete,
                    "Escape" => Code::Escape,
                    "Up" => Code::ArrowUp,
                    "Down" => Code::ArrowDown,
                    "Left" => Code::ArrowLeft,
                    "Right" => Code::ArrowRight,
                    _ => return Err(format!("未知的按键: {}", key)),
                });
            }
        }
    }

    let code = key_code.ok_or("快捷键必须包含主键")?;
    let mods = if modifiers.is_empty() {
        None
    } else {
        Some(modifiers)
    };

    Ok(Shortcut::new(mods, code))
}

/// 注销当前所有快捷键
fn unregister_all(app: &AppHandle) {
    let mut current = CURRENT_SHORTCUTS.lock().unwrap();
    if let Some((translate, show)) = current.take() {
        let _ = app.global_shortcut().unregister(translate);
        let _ = app.global_shortcut().unregister(show);
    }
}

/// 注册快捷键
pub fn register_shortcuts(
    app: &AppHandle,
    translate_shortcut_str: &str,
    show_shortcut_str: &str,
) -> Result<(), String> {
    // 先注销旧的快捷键
    unregister_all(app);

    // 解析新的快捷键
    let translate_shortcut = parse_shortcut(translate_shortcut_str)?;
    let show_shortcut = parse_shortcut(show_shortcut_str)?;

    // 注册划词翻译快捷键
    let app_for_translate = app.clone();
    app.global_shortcut()
        .on_shortcut(translate_shortcut.clone(), move |_app, _shortcut, _event| {
            let app = app_for_translate.clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(text) = get_selected_text(&app).await {
                    let _ = popup::show_popup(&app, text).await;
                }
            });
        })
        .map_err(|e| format!("注册划词翻译快捷键失败: {}", e))?;

    // 注册显示主窗口快捷键
    let app_for_show = app.clone();
    app.global_shortcut()
        .on_shortcut(show_shortcut.clone(), move |_app, _shortcut, _event| {
            if let Some(window) = app_for_show.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        })
        .map_err(|e| format!("注册显示窗口快捷键失败: {}", e))?;

    // 保存当前注册的快捷键
    let mut current = CURRENT_SHORTCUTS.lock().unwrap();
    *current = Some((translate_shortcut, show_shortcut));

    Ok(())
}
```

**Step 2: 验证 Rust 编译**

Run: `cd src-tauri && cargo check`
Expected: 编译成功

**Step 3: Commit**

```bash
git add src-tauri/src/shortcut.rs
git commit -m "feat: support dynamic shortcut registration in Rust"
```

---

## Task 5: 注册 Tauri 命令并连接前端

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Create: `src/services/shortcut.ts`
- Modify: `src/App.tsx`

**Step 1: 在 lib.rs 中添加 Tauri 命令**

添加导入和命令：

```rust
use shortcut::register_shortcuts;

#[tauri::command]
fn update_shortcuts(
    app: AppHandle,
    translate: String,
    show_window: String,
) -> Result<(), String> {
    register_shortcuts(&app, &translate, &show_window)
}
```

在 `.invoke_handler()` 中添加命令：
```rust
.invoke_handler(tauri::generate_handler![
    translate,
    close_popup,
    update_shortcuts,  // 添加这行
])
```

修改 `run()` 函数中的初始化调用（使用默认值）：
```rust
// 使用默认快捷键初始化
if let Err(e) = register_shortcuts(
    app.handle(),
    "CommandOrControl+Shift+T",
    "CommandOrControl+Shift+Space",
) {
    eprintln!("注册快捷键失败: {}", e);
}
```

**Step 2: 创建前端 shortcut 服务**

创建 `src/services/shortcut.ts`：

```typescript
import { invoke } from '@tauri-apps/api/core';

export async function updateShortcuts(translate: string, showWindow: string): Promise<void> {
  await invoke('update_shortcuts', {
    translate,
    showWindow,
  });
}
```

**Step 3: 在 App.tsx 中初始化快捷键**

在 App.tsx 中添加初始化逻辑：

```tsx
import { useEffect } from 'react';
import { useSettingsStore } from './stores/settingsStore';
import { updateShortcuts } from './services/shortcut';

// 在 App 组件中添加:
const { shortcuts } = useSettingsStore();

useEffect(() => {
  updateShortcuts(shortcuts.translate, shortcuts.showWindow).catch(console.error);
}, [shortcuts.translate, shortcuts.showWindow]);
```

**Step 4: 验证完整流程**

Run: `npm run tauri dev`
Expected:
1. 应用启动后快捷键正常工作
2. 在设置中修改快捷键后立即生效
3. 重启应用后快捷键配置保持

**Step 5: Commit**

```bash
git add src-tauri/src/lib.rs src/services/shortcut.ts src/App.tsx
git commit -m "feat: wire up shortcut settings with Tauri backend"
```

---

## 验证清单

完成所有任务后，验证以下功能：

- [ ] 设置页面显示快捷键配置区域
- [ ] 点击输入框可以录入新快捷键
- [ ] 录入时显示"请按下快捷键..."
- [ ] 按 Esc 取消录入
- [ ] 点击外部取消录入
- [ ] 系统保留快捷键显示错误提示
- [ ] 两个快捷键相同时显示冲突警告
- [ ] 修改后快捷键立即生效
- [ ] 重启应用后配置保持
- [ ] "重置"按钮恢复默认值
