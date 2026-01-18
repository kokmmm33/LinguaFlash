# Excel 翻译并发支持设计

## 概述

为 Excel 翻译功能添加并发支持，提高大文件翻译速度，同时避免触发 API 速率限制。

## 设计决策

### 1. 配置位置
- **全局设置页面**，新增"Excel 翻译"区域
- 用户配置一次后所有 Excel 翻译任务共用

### 2. 参数设计

| 参数 | 范围 | 默认值 | 说明 |
|------|------|--------|------|
| 并发数 (concurrency) | 1-20 | 3 | 同时进行的翻译请求数 |
| 请求间隔 (requestInterval) | 0-1000ms | 100ms | 每批请求之间的等待时间 |
| 重试次数 (retryCount) | 0-5 | 2 | 单个请求失败后的重试次数 |
| 重试延迟 (retryDelay) | 1-10s | 2s | 重试前的等待时间（指数退避基数） |

### 3. 错误处理策略：自动降级

1. 检测到 429（限流）或 5xx 错误时：
   - 将当前并发数减半（最低降至 1）
   - 等待重试延迟后继续
   - 在进度事件中通知前端发生了降级

2. 翻译完成后：
   - 恢复用户设置的原始并发数
   - 降级状态不持久化

### 4. 进度显示

- 保持现有显示方式（已翻译 X/Y 个单元格）
- 并发模式下进度会跳跃式增长，这是正常行为
- 进度事件中包含当前并发数信息，但前端暂不显示

## 技术实现

### Rust 端

1. **并发控制**
   - 使用 `tokio::sync::Semaphore` 限制并发数
   - 使用 `futures::stream::buffer_unordered` 批量处理

2. **数据结构更新**
   ```rust
   pub struct ConcurrencyConfig {
       pub concurrency: u32,        // 并发数
       pub request_interval: u64,   // 请求间隔 (ms)
       pub retry_count: u32,        // 重试次数
       pub retry_delay: u64,        // 重试延迟 (s)
   }
   ```

3. **翻译器改造**
   - 收集所有需要翻译的单元格
   - 使用 Semaphore 控制并发执行
   - 使用 Arc<AtomicU32> 跟踪当前并发数（支持降级）

### 前端

1. **设置存储** (settingsStore)
   ```typescript
   interface ExcelSettings {
     concurrency: number;
     requestInterval: number;
     retryCount: number;
     retryDelay: number;
   }
   ```

2. **设置页面 UI**
   - 在"术语表"区域下方添加"Excel 翻译"设置区域
   - 使用滑块 + 数字输入框组合

3. **IPC 更新**
   - `start_excel_translation` 命令增加 `concurrency_config` 参数

## 不同引擎的建议配置

| 引擎 | 建议并发数 | 建议间隔 | 说明 |
|------|-----------|---------|------|
| Ollama（本地） | 5-10 | 0ms | 取决于 GPU 内存 |
| GLM（智谱）免费版 | 2-3 | 200ms | 约 5 QPS 限制 |
| GLM（智谱）付费版 | 5-10 | 100ms | 更高配额 |
| OpenAI（未来） | 3-5 | 100ms | 根据 tier 调整 |

## 文件变更清单

### 新增
- 无

### 修改
- `src-tauri/Cargo.toml` - 添加 futures 依赖
- `src-tauri/src/excel/mod.rs` - 添加 ConcurrencyConfig 结构
- `src-tauri/src/excel/translator.rs` - 重构为并发执行
- `src-tauri/src/lib.rs` - 更新 IPC 命令签名
- `src/stores/settingsStore.ts` - 添加 Excel 设置
- `src/services/excel.ts` - 更新 IPC 调用
- `src/stores/excelStore.ts` - 传递并发配置
- `src/pages/SettingsPage.tsx` - 添加 Excel 设置 UI
