# 自定义快捷键设计文档

## 概述

为 TTime 添加自定义快捷键功能，允许用户修改划词翻译和显示主窗口的快捷键。

## 需求

- **可自定义的快捷键**：划词翻译、显示主窗口
- **输入方式**：键盘录入（点击输入框后直接按组合键）
- **冲突处理**：提示冲突但允许保存

---

## 数据结构与存储

**快捷键配置格式：**
```typescript
interface ShortcutConfig {
  translate: string;    // 如 "CommandOrControl+Shift+T"
  showWindow: string;   // 如 "CommandOrControl+Shift+Space"
}
```

使用 `CommandOrControl` 作为跨平台修饰键（macOS 上是 Cmd，Windows 上是 Ctrl）。

**存储位置：**
- 前端：扩展 `settingsStore.ts`，添加 `shortcuts` 字段
- 通过 Zustand persist 自动持久化到 localStorage
- 应用启动时从前端读取配置，传给 Rust 后端注册

**默认值：**
```typescript
shortcuts: {
  translate: 'CommandOrControl+Shift+T',
  showWindow: 'CommandOrControl+Shift+Space',
}
```

---

## 前端 UI

**设置页面新增区块：**
在 `SettingsPage.tsx` 的"外观"和"数据管理"之间添加"快捷键"区域。

**UI 结构：**
```
┌─ 快捷键 ─────────────────────────────────────┐
│                                              │
│  划词翻译     [ ⌘ Shift T        ] [重置]    │
│                                              │
│  显示主窗口   [ ⌘ Shift Space    ] [重置]    │
│                                              │
│  ⚠️ 快捷键可能与其他应用冲突（冲突时显示）    │
└──────────────────────────────────────────────┘
```

**交互流程：**
1. 点击输入框 → 显示"请按下快捷键..."
2. 按下组合键 → 显示录入的快捷键（如 `⌘ Shift T`）
3. 检测冲突 → 若与另一个 TTime 快捷键相同，显示警告
4. 失焦或按 Enter → 保存并通知后端重新注册
5. 按 Esc → 取消录入，恢复原值
6. 点击"重置" → 恢复默认快捷键

**新建组件：**
- `src/components/ShortcutInput.tsx` - 快捷键录入组件

---

## 后端实现

**Rust 端修改：**

1. **新增 Tauri 命令** `update_shortcuts`：
   - 接收前端传来的快捷键配置
   - 先注销旧的快捷键
   - 解析新配置并注册
   - 返回成功/失败状态

2. **修改 `shortcut.rs`**：
   - `register_shortcuts` 改为接收快捷键字符串参数
   - 新增 `unregister_shortcuts` 函数用于注销
   - 新增 `parse_shortcut` 函数解析字符串为 `Shortcut` 对象

**字符串解析示例：**
```
"CommandOrControl+Shift+T"
  → Modifiers: META|SHIFT (macOS) 或 CONTROL|SHIFT (Windows)
  → Code: KeyT
```

**应用启动流程：**
```
App 启动 → 前端加载 settingsStore
        → 调用 update_shortcuts 命令
        → Rust 注册快捷键
```

**设置更改流程：**
```
用户修改快捷键 → 更新 settingsStore
             → 调用 update_shortcuts 命令
             → Rust 注销旧快捷键 → 注册新快捷键
```

---

## 错误处理与边界情况

| 场景 | 处理方式 |
|------|----------|
| 无效快捷键格式 | 前端录入时过滤，只允许有效组合键 |
| 快捷键注册失败 | 显示错误提示，保留旧快捷键 |
| 两个快捷键相同 | 显示警告"与 XX 快捷键相同"，仍允许保存 |
| 只按修饰键 | 不记录，等待用户按下主键 |
| 单键（无修饰键） | 不允许，全局快捷键必须包含修饰键 |

**允许的修饰键组合：**
- `CommandOrControl` (必须)
- `Shift` (可选)
- `Alt/Option` (可选)

**允许的主键：**
- 字母键：A-Z
- 数字键：0-9
- 功能键：F1-F12
- 特殊键：Space, Enter, Tab, 方向键等

**禁止的快捷键：**
- 系统保留：`Cmd+Q`, `Cmd+W`, `Cmd+C`, `Cmd+V` 等
- 无修饰键的单键

---

## 文件清单

| 操作 | 文件 |
|------|------|
| 新建 | `src/components/ShortcutInput.tsx` |
| 修改 | `src/stores/settingsStore.ts` |
| 修改 | `src/pages/SettingsPage.tsx` |
| 修改 | `src-tauri/src/shortcut.rs` |
| 修改 | `src-tauri/src/lib.rs` |
