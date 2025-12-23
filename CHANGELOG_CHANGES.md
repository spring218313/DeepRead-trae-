# DeepRead 修改记录（本次重构）

## 变更概要

- 后端数据层：将 `backend/lib/db.ts` 的 DB 实现改为基于 Web Storage 的本地持久化，保持现有 DAO API 不变。
- 书籍导入：新增首页右上角 “+” 导入入口，支持 `EPUB` / `PDF` / `TXT` 导入、格式校验与导入进度展示。
- 平板横屏：修复横屏分屏笔记本在手写模式下工具栏按钮点击失效问题，并修复擦除逻辑以避免无效错误提示。
- 测试：补充导入、后端本地 DB、横屏工具栏的单元/集成测试，并新增 `vitest` 测试脚本。

## 变更文件列表

- `App.tsx`
- `components/Reader.tsx`
- `bookImport.ts`
- `backend/lib/db.ts`
- `vite.config.ts`
- `vitest.setup.ts`
- `shims.d.ts`
- `package.json`
- `package-lock.json`
- `bookImport.test.ts`
- `App.import.test.tsx`
- `Reader.tabletToolbar.test.tsx`
- `backendDb.test.ts`

## 关键变更点（按文件）

- `backend/lib/db.ts`
  - `createDB().query(...)` 由空实现改为基于 `localStorage` 的轻量 SQL 适配层（支持项目内现有 DAO 使用到的 `INSERT/UPDATE/DELETE/SELECT` 形态）。
  - 在无 `localStorage` 环境下使用内存表兜底，保证测试可运行。

- `bookImport.ts`
  - 新增导入管线：文件选择 → 格式校验 → 读取 → 解析 → 本地写入 → 完成。
  - PDF 解析基于 `pdfjs-dist`，EPUB 解析基于 `epubjs`，TXT 直接分段解析。
  - 为兼容性与既有导出/导入机制：导入书籍同时写入 IndexedDB（优先）与 `localStorage`（用于 `dr_*` 导出）。

- `App.tsx`
  - 首页右上角 “+” 按钮接入导入流程，弹出玻璃风格 Modal 显示进度条与错误信息。
  - 启动时加载已导入书籍并合并到书架列表。

- `components/Reader.tsx`
  - 平板横屏分屏笔记本工具栏提升层级与事件可达性，保证手写模式下按钮仍可点击。
  - 调整擦除逻辑，避免使用 `null as any` 导致潜在异常/无效错误提示。

- `vite.config.ts` / `vitest.setup.ts` / `shims.d.ts`
  - 增加 `vitest` 配置，提供 `jsdom` 环境、IndexedDB mock、Canvas `getContext` mock、PDF worker 类型声明。

