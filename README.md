# 📖 嗷嗷日记本 (AoAo Diary)

> 一个极简、私密、专属于两个人的共享日记本。

没有繁琐的登录，没有复杂的社交，只有纯粹的记录和彼此的陪伴。

## ✨ 特色功能

*   **🔒 私密共享**：无需注册登录，依靠网址隐蔽性保障安全，像一本放在家里的实体笔记本。
*   **⚡️ 极速体验**：本地缓存加持，网页秒开，支持离线查看。
*   **🎨 iOS 设计**：精致的卡片式布局，细腻的交互动效，支持暗黑模式（系统跟随）。
*   **📸 多图记录**：支持九宫格图片上传，记录生活点滴。
*   **🥚 浪漫彩蛋**：触发特定关键词（如“爱你”、“生气”、“干饭”）会有满屏惊喜特效。
*   **📱 移动端适配**：完美支持手机浏览器，隐藏冗余 UI，沉浸式体验。

## 🛠️ 技术栈

*   **前端**：Vue.js 3 (CDN 模式，轻量无构建)
*   **后端**：Supabase (PostgreSQL + Storage)
*   **部署**：Cloudflare Pages / GitHub Pages
*   **特效**：canvas-confetti

## 🚀 快速开始

### 1. 配置 Supabase
1.  创建一个 Supabase 项目。
2.  执行 SQL 初始化数据库表：
    ```sql
    create table notes (
      id uuid default uuid_generate_v4() primary key,
      text text,
      images text[],
      tags text[],
      mood text,
      timestamp bigint,
      favorite boolean default false,
      likecount int default 0,
      comments jsonb default '[]'::jsonb
    );
    ```
3.  创建一个名为 `images` 的公开 Storage Bucket。
4.  **关键步骤**：在 Supabase 后台设置 RLS (Row Level Security) 策略，允许 `anon` (匿名) 角色对 `notes` 表和 `images` 存储桶进行 `SELECT`, `INSERT`, `UPDATE`, `DELETE` 操作。

### 2. 连接项目
修改 `js/supabase.js` (如果未分离则在 `js/storage.js` 或 `app.js` 中)，填入你的 Supabase URL 和 Anon Key。

### 3. 部署
将代码推送到 GitHub，连接 Cloudflare Pages 即可自动部署。

## 🥚 彩蛋指令列表

试试在日记里写下这些词：
*   ❤️ **甜蜜**：`爱你`、`想你`、`喜欢`
*   💢 **哄哄**：`生气`、`哼`、`讨厌`
*   🍔 **干饭**：`饿了`、`吃火锅`、`奶茶`
*   💸 **暴富**：`暴富`、`发工资`、`钱`
*   🌙 **晚安**：`晚安`、`睡了`
*   🐶 **萌宠**：`猫咪`、`狗狗`

---
*Built with ❤️ for two.*
