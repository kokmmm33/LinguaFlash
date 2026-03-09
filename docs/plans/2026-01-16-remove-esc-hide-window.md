# 移除 ESC 键隐藏窗口功能 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 移除按 ESC 键隐藏 LinguaFlash 应用窗口的功能

**Architecture:** 简单地从 App.tsx 中删除 ESC 键事件监听器

**Tech Stack:** React, TypeScript, Tauri 2.0

---

### Task 1: 移除 ESC 键隐藏窗口功能

**Files:**
- Modify: `src/App.tsx:44-51`

**Step 1: 删除 ESC 键事件监听代码**

删除以下代码块（第 44-51 行）：

```tsx
// ESC 键隐藏窗口
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      getCurrentWindow().hide();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

同时删除不再需要的 `getCurrentWindow` 导入（如果没有其他地方使用）。

**Step 2: 验证修改**

检查 `src/App.tsx` 顶部，确认 `getCurrentWindow` 是否仍在其他地方使用：
- 如果没有其他地方使用，同时删除 `import { getCurrentWindow } from '@tauri-apps/api/window';`
- 如果有其他地方使用，保留导入

**Step 3: 测试验证**

运行应用：
```bash
npm run tauri dev
```

测试场景：
1. 打开 LinguaFlash 应用窗口
2. 按 `Escape` 键
3. **预期结果：** 窗口应该保持显示，不会隐藏
4. 窗口仍可通过其他方式关闭（如关闭按钮、`Cmd+W` 等）

**Step 4: 提交更改**

```bash
git add src/App.tsx
git commit -m "feat: remove ESC key hide window functionality"
```

---

### 验证清单

- [ ] ESC 键代码已删除
- [ ] 未使用的导入已清理
- [ ] 应用正常启动
- [ ] 按 ESC 键窗口不会隐藏
- [ ] 其他窗口功能正常工作

---

### 备注

此变更仅影响 ESC 键的行为，其他快捷键（如 `Cmd+Shift+Space` 显示窗口）不受影响。
