# 性能优化方案设计：CDN 替换与初始化加速

## 1. 目标
解决“嗷嗷日记本”在移动端首屏加载延迟严重（约 10s）的问题，将加载时间优化至 1-2s 以内。

## 2. 核心改动
### 2.1 静态资源源替换 (HTML)
- **现状**：使用 `unpkg.com`，国内访问极不稳定，是卡顿主因。
- **改动**：
  - 移除 `unpkg.com` 链接及预连接。
  - 引入 `cdn.bootcdn.net` (BootCDN) 作为 Vue 3 和 Supabase SDK 的源。
  - 添加 `dns-prefetch` 预解析，微调网络连接。
  - 显式锁定 Vue 3.3.4 和 Supabase 2.39.7 版本，保证稳定性。

### 2.2 初始化逻辑重构 (JS)
- **现状**：`Storage.init` 使用 `setInterval` 轮询检查 SDK，最大等待 5s，被动且低效。
- **改动**：
  - 移除 `waitForSupabase` 轮询函数。
  - `init` 方法直接检查 `window.supabase` 对象。
  - 依赖浏览器 `defer` 属性保证脚本执行顺序，消除 JS层面的等待开销。
  - 失败时直接抛出明确错误，而非静默超时。

### 2.3 界面交互微调 (Vue)
- **现状**：加载提示语分三阶段跳变，优化后前两阶段过快会导致闪烁。
- **改动**：合并“初始化”与“连接数据库”提示语，仅保留“正在启动...”和“正在加载笔记...”两阶段，提升视觉稳定性。

## 3. 文件变更清单
1. `index.html`: 替换 script 标签，修改 head。
2. `js/storage.js`: 重写 `Storage.init`，删除 `waitForSupabase`。
3. `js/app.js`: 简化 `mounted` 中的 loading 提示逻辑。

## 4. 验证计划
1. 修改后本地预览，确认控制台无 404 错误。
2. 观察 Network 面板，确认 JS 资源是否从 `cdn.bootcdn.net` 加载。
3. 刷新页面，主观感受加载动画是否流畅过渡。
