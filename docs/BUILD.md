# 本地构建 & 环境 & 数据库（我的书斋）

> 面向第一次拉取仓库、想在本机把「我的书斋」跑起来的开发者。
> 全程在 Windows + Git Bash 下操作。数据库用 Supabase 云端实例（本仓库只含 SQL，不跑本地 Postgres）。

---

## 1. 前置条件

| 工具 | 版本要求 | 说明 |
|---|---|---|
| Node.js | ≥ 20 | 跑 Next.js 16 |
| npm | 随 Node | 包管理 |
| Supabase 账号 + 一个 Project | 免费即可 | 云数据库 / Auth / Realtime |

---

## 2. 安装依赖

```bash
cd /c/Users/OMEN/habit-tracker
npm install
```

> 依赖清单见 `package.json`：`next 16.4.0`、`react/react-dom 19.3.0`、`@supabase/ssr`、`@supabase/supabase-js`、`lucide-react`，以及 Tailwind v4 等 devDeps。
> **本项目不自动装新依赖**——若需要，用户会自行安装；改代码时不要擅自 `npm install` 新包。

---

## 3. 环境变量

在项目根目录新建 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

两个值都在 Supabase Dashboard → Project Settings → API 里。

> ⚠️ **`NEXT_PUBLIC_SUPABASE_URL` 一定不要带 `/rest/v1/` 后缀。** 只填到 `.supabase.co` 为止。带了后缀是注册报错的常见根因。

---

## 4. 数据库初始化（Supabase SQL Editor）

本项目**所有后端表结构都在 SQL 文件里**，前端不含建表逻辑。按顺序在 Supabase Dashboard → SQL Editor 里粘贴执行：

| 顺序 | 文件 | 作用 |
|---|---|---|
| 1 | `defense-simulator/supabase/migrations/00001_init.sql` | **基础表**（只读参考文件，位于旧项目，不要改它）：`profiles` / `habits` / `habit_checkins` / `habit_streaks` / `tags` / `habit_tags`、RLS、触发器、`v_dashboard`、`toggle_checkin` |
| 2 | `supabase/m2_setup.sql` | 启用 Realtime（`habits` / `habit_checkins` / `habit_streaks` 三表发布）+ 视图补 `description`/`created_at` |
| 3 | `supabase/m5_setup.sql` | **最终版补充（跑这一份即可，已含 M4 全部内容）**：`habits.cover` 列、`set_checkin_count` RPC、视图补 `cover`/`today_count`、`habit_notes` 表 + `set_habit_note` RPC |

> - `m4_setup.sql` 已被 `m5_setup.sql` 完全覆盖，**不必再跑**，仅作历史留存。
> - 所有 SQL 都是**幂等**的（`create or replace` / `if not exists` / `do $$` 判断），可重复执行不报错。
> - 基础表 `00001_init.sql` 在 `defense-simulator` 旧项目里，是**只读**参考，本仓库不复制它，避免偏离真相。

**执行后验证：**
- `Authentication → Users` 里注册一个账号后，`Table Editor → profiles` 应自动出现一行（`handle_new_user` 触发器生效）。
- `Database → Replication` 里 `supabase_realtime` 发布应包含 `habits` / `habit_checkins` / `habit_streaks`。

---

## 5. 启动开发服务器

```bash
cd /c/Users/OMEN/habit-tracker
npm run dev
```

访问 `http://localhost:3000`。

> 注意：根路由 `/` 目前仍是 Next 样板页。请直接访问 `/login` 注册 / 登录，登录后跳转 `/dashboard`。

---

## 6. 验证（提交前必跑）

```bash
npx tsc --noEmit -p /c/Users/OMEN/habit-tracker/tsconfig.json
cd /c/Users/OMEN/habit-tracker && npm run lint
```

两条都要零报错。

---

## 7. 生产构建（可选）

```bash
cd /c/Users/OMEN/habit-tracker
npm run build
npm start
```

---

## 8. 常见问题

| 现象 | 原因 | 解法 |
|---|---|---|
| 注册报错 | `NEXT_PUBLIC_SUPABASE_URL` 带了 `/rest/v1/` | 去掉后缀，只留到 `.supabase.co` |
| 登录后无限跳转 / 跳回登录 | 未跑 `m2_setup.sql` 或 proxy 缓存 | 确认第 4 步 SQL 都执行过，重启 dev |
| 打卡不实时刷新 | Realtime 未启用 | 检查 `m2_setup.sql` 是否执行、`supabase_realtime` 发布是否含三表 |
| 首页是 Next 样板 | 根路由未接跳转 | 这是已知待办，直接访问 `/login` |
| 未知图标显示成通用勾 | `habits.icon` 存的 key 不在 `lib/icons.ts` | 改数据或补 `ICON_OPTIONS` |
