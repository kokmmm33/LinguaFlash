# Excel 翻译并发支持实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 Excel 翻译添加并发执行支持，提高翻译速度

**Architecture:** 使用 Tokio Semaphore 控制并发数，futures stream 批量处理，自动降级处理 API 限流

**Tech Stack:** Rust (tokio, futures), TypeScript (React, Zustand)

---

### Task 1: 添加 futures 依赖

**Files:**
- Modify: `src-tauri/Cargo.toml`

**Step 1: 添加 futures crate**

在 `[dependencies]` 中添加：
```toml
futures = "0.3"
```

**Step 2: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译通过

**Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "chore: add futures dependency for concurrency support"
```

---

### Task 2: 添加 ConcurrencyConfig 结构

**Files:**
- Modify: `src-tauri/src/excel/mod.rs`

**Step 1: 添加结构定义**

在 `mod.rs` 中添加：
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcurrencyConfig {
    pub concurrency: u32,
    pub request_interval: u64,  // ms
    pub retry_count: u32,
    pub retry_delay: u64,       // seconds
}

impl Default for ConcurrencyConfig {
    fn default() -> Self {
        Self {
            concurrency: 3,
            request_interval: 100,
            retry_count: 2,
            retry_delay: 2,
        }
    }
}
```

**Step 2: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译通过

**Step 3: Commit**

```bash
git add src-tauri/src/excel/mod.rs
git commit -m "feat(excel): add ConcurrencyConfig struct"
```

---

### Task 3: 重构 translator.rs 支持并发

**Files:**
- Modify: `src-tauri/src/excel/translator.rs`

**Step 1: 添加必要的 imports**

```rust
use std::sync::atomic::AtomicU32;
use tokio::sync::Semaphore;
use tokio::time::{sleep, Duration};
use futures::stream::{self, StreamExt};
```

**Step 2: 修改 translate_sheets 函数签名**

添加 `concurrency_config: &ConcurrencyConfig` 参数

**Step 3: 实现并发翻译逻辑**

1. 先过滤出需要翻译的单元格（排除术语表匹配和缓存命中）
2. 使用 Semaphore 控制并发
3. 使用 stream::iter + buffer_unordered 并发执行
4. 收集结果并更新单元格

**Step 4: 添加重试逻辑**

在 translate_cell 中添加重试循环，检测 429/5xx 错误

**Step 5: 添加自动降级逻辑**

使用 Arc<AtomicU32> 跟踪当前并发数，遇到限流时减半

**Step 6: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译通过

**Step 7: Commit**

```bash
git add src-tauri/src/excel/translator.rs
git commit -m "feat(excel): implement concurrent translation with auto-degradation"
```

---

### Task 4: 更新 IPC 命令

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: 更新 start_excel_translation 命令**

添加 `concurrency_config: excel::ConcurrencyConfig` 参数，传递给 translator

**Step 2: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译通过

**Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(excel): add concurrency config to IPC command"
```

---

### Task 5: 前端 - 更新 settingsStore

**Files:**
- Modify: `src/stores/settingsStore.ts`

**Step 1: 添加 Excel 设置类型和状态**

```typescript
interface ExcelSettings {
  concurrency: number;
  requestInterval: number;
  retryCount: number;
  retryDelay: number;
}

const DEFAULT_EXCEL_SETTINGS: ExcelSettings = {
  concurrency: 3,
  requestInterval: 100,
  retryCount: 2,
  retryDelay: 2,
};
```

**Step 2: 添加到 store state 和 actions**

添加 `excelSettings` 状态和 `setExcelSettings` action

**Step 3: 验证编译**

Run: `npm run build`
Expected: 编译通过

**Step 4: Commit**

```bash
git add src/stores/settingsStore.ts
git commit -m "feat(settings): add excel concurrency settings"
```

---

### Task 6: 前端 - 更新 excel service

**Files:**
- Modify: `src/services/excel.ts`

**Step 1: 添加 ConcurrencyConfig 类型**

```typescript
export interface ConcurrencyConfig {
  concurrency: number;
  request_interval: number;
  retry_count: number;
  retry_delay: number;
}
```

**Step 2: 更新 startExcelTranslation 函数**

添加 `concurrencyConfig` 参数

**Step 3: 验证编译**

Run: `npm run build`
Expected: 编译通过

**Step 4: Commit**

```bash
git add src/services/excel.ts
git commit -m "feat(excel): add concurrency config to service"
```

---

### Task 7: 前端 - 更新 excelStore

**Files:**
- Modify: `src/stores/excelStore.ts`

**Step 1: 导入 settingsStore**

从 settingsStore 获取 excelSettings

**Step 2: 更新 startTranslation**

构造 concurrencyConfig 并传递给 service

**Step 3: 验证编译**

Run: `npm run build`
Expected: 编译通过

**Step 4: Commit**

```bash
git add src/stores/excelStore.ts
git commit -m "feat(excel): pass concurrency config from settings"
```

---

### Task 8: 前端 - 添加设置 UI

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

**Step 1: 导入 excelSettings 相关**

从 settingsStore 获取 excelSettings 和 setExcelSettings

**Step 2: 添加 Excel 翻译设置区域**

在"术语表"区域下方添加新 section，包含：
- 并发数滑块 (1-20)
- 请求间隔滑块 (0-1000ms)
- 重试次数滑块 (0-5)
- 重试延迟滑块 (1-10s)

每个设置项显示当前值和说明文字

**Step 3: 验证编译和 UI**

Run: `npm run build`
Expected: 编译通过

**Step 4: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat(settings): add excel concurrency settings UI"
```

---

### Task 9: 集成测试

**Step 1: 运行完整构建**

Run: `npm run tauri build`
Expected: 构建成功

**Step 2: 功能验证清单**

- [ ] 设置页面显示 Excel 翻译设置区域
- [ ] 滑块可正常调节，值实时更新
- [ ] 设置在刷新后保持（persist）
- [ ] Excel 翻译使用配置的并发数
- [ ] 取消功能仍然有效

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(excel): complete concurrency support implementation"
```

---

### Task 10: 更新版本号

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src/pages/SettingsPage.tsx`

**Step 1: 更新版本号到 1.2.0**

在所有配置文件中将版本号从 1.1.0 更新为 1.2.0

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: bump version to 1.2.0"
```
