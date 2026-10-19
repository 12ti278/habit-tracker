<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md —— 「我的书斋」项目指南（给 AI 编码代理）

> 本文件是「我的书斋」个人习惯打卡系统的开发约定。任何在本仓库改代码的代理（Claude Code 等）都必须先读这里，再动手。

## 0. 一句话

这是一个 **Next.js 16 + Supabase** 的个人习惯打卡 Web 应用，视觉主题是「一本书 = 一个习惯」。数据库是唯一事实来源，安全靠 RLS。

## 1. 红线（务必遵守）

- **绝不改动 `C:\Users\OMEN\defense-simulator` 里的任何东西。** 那是旧项目，只作只读参考（其中的 `supabase/migrations/00001_init.sql` 是本系统基础表结构的来源）。
- **不要向用户粘贴大段代码块。** 用户明确要求：直接改文件、不要发代码块。
- **需要新依赖时，告诉用户装什么，由用户自己在终端装。**

## 2. Next.js 16 破坏性改动（除上方自动块外，再强调这几个）

- `middleware.ts` 已重命名为 **`proxy.ts`**（根目录，导出 `proxy` 函数，附 `config.matcher`）。
- **`cookies()` 是异步的**，必须 `await cookies()`。
- **`params` / `searchParams` 是 Promise**，取用前要 `await`。
- **`LayoutProps<'/route'>` / `PageProps<'/route'>` 是全局类型**，无需 import。
- React 19 的 `useActionState`、`redirect()`（会抛控制流异常）等新原语。

## 3. 目录结构

```
habit-tracker/
├── proxy.ts                      # Next 16 的 middleware：会话刷新 + 路由跳转
├── app/
│   ├── layout.tsx / globals.css  # 根布局 + Tailwind v4 主题 / .glass 毛玻璃
│   ├── page.tsx                  # / （仍是样板页，见「已知待办」）
│   ├── auth/actions.ts           # login / signup / logout（Server Actions）
│   ├── login/page.tsx            # 登录（useActionState）
│   ├── register/page.tsx         # 注册
│   ├── habits/actions.ts         # 习惯 create/update/delete（Server Actions）
│   ├── tags/actions.ts           # 标签 create/delete
│   └── dashboard/
│       ├── page.tsx              # 服务端：getUser + 并行取数 → 传 initialXxx
│       ├── dashboard-client.tsx  # 客户端：书架/今日汇总/统计/Realtime/表单
│       ├── book-detail.tsx       # 展开书：历史热力图 + 备注 + 编辑删除
│       └── heatmap.tsx           # 共享月历热力图组件
├── lib/
│   ├── covers.ts                 # 4 种马卡龙书封（getCover）
│   └── icons.ts                  # 15 个 lucide 图标（ICON_OPTIONS / HabitIcon）
├── types/
│   ├── habit.ts                  # HabitRow / CheckinSummary
│   └── tag.ts                    # Tag / HabitTag
├── utils/supabase/
│   ├── server.ts                 # 服务端 createClient（async cookies）
│   └── client.ts                 # 浏览器 createClient
├── supabase/                     # SQL 迁移（在 Supabase SQL Editor 执行）
│   └── m2_setup.sql / m4_setup.sql / m5_setup.sql
└── .env.local                    # NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
```

## 4. 核心约定

### 4.1 数据流（贯穿全站，不要另起炉灶）

1. **Server Component（`app/**/page.tsx`）**：`getUser()` 鉴权 → `Promise.all` 并行取数 → 作为 `initialXxx` props 传给 Client Component。
2. **Client Component**：`useState(initialXxx)` 持有服务端快照 → Realtime `postgres_changes` 触发 `refetch()` → 写操作先乐观更新本地 state，再调 RPC，失败则 `refetch()` 回滚。

### 4.2 Supabase 客户端

- 服务端：`import { createClient } from "@/utils/supabase/server"`，**每个请求新建一个**，别跨请求复用。
- 浏览器：`import { createClient } from "@/utils/supabase/client"`，组件里用 `useMemo(() => createClient(), [])` 保持稳定实例。

### 4.3 写操作走 RPC / Server Action，不走前端直写表

- 打卡：`rpc("set_checkin_count", { p_habit_id, p_count, p_date })`（`count ≤ 0` 删行）。
- 备注：`rpc("set_habit_note", { p_habit_id, p_note, p_date })`。
- 习惯/标签 CRUD：`app/habits/actions.ts` / `app/tags/actions.ts` 里的 Server Action，末尾 `revalidatePath("/dashboard")`。

### 4.4 React 19 的两条 lint 规则（很容易踩）

- **`react-hooks/set-state-in-effect`**：effect 里不能同步 `setState`。取数函数只返回数据，`setState` 放进 `.then/.catch/.finally`，清理用 `cancelled` 标志。
- **`react-hooks/static-components`**：别在 render 里 `const Icon = getIcon(...)` 再 `<Icon/>`。用模块级组件 `<HabitIcon name={...} />`（`lib/icons.ts`）。

### 4.5 Tailwind v4

- CSS-first：`globals.css` 里 `@theme` 定义令牌（`--color-cream/ink/ink-soft/ink-muted/line/accent/accent-strong`、`--font-sans`），生成的工具类如 `bg-cream`、`text-ink-muted`、`text-accent-strong`。
- 自定义组件样式写 `.glass`（毛玻璃卡片）。

## 5. 数据库要点

- **安全边界 = RLS**。所有表 `enable row level security`，规则统一「`auth.uid() = user_id`」；`habit_tags` 无 `user_id`，靠 `exists` 借道 `habits` 判断。
- **Schema 演进**：改表结构就新增一份 `supabase/mXX_setup.sql`（幂等，`create or replace` / `if not exists`），不要改历史迁移。
- 关键事实：打卡一天一行（`UNIQUE(habit_id, checkin_date)`），`count` 列存当日完成次数；streak 由触发器维护，前端只读；备注在独立表 `habit_notes`（与打卡解耦）。
- 完整表结构设计理由见 `docs/TECH_DESIGN.md` 第 4 节。

## 6. 验证命令

改完必须跑通（Windows Git Bash，注意 cwd 会重置，用绝对路径或 `cd ... && ...`）：

```bash
npx tsc --noEmit -p /c/Users/OMEN/habit-tracker/tsconfig.json
cd /c/Users/OMEN/habit-tracker && npm run lint
```

## 7. 已知待办 / 坑

- `app/page.tsx`（`/` 根路由）仍是 Next 样板页，未重定向。
- `.env.local` 的 `NEXT_PUBLIC_SUPABASE_URL` **不要带 `/rest/v1/` 后缀**（这是之前注册报错的根因）。
- 旧的 emoji 图标已废弃：现在 `habits.icon` 存 lucide 的 key（如 `droplets`），未知 key 会回退成默认「通用」图标。
- 从零建库需要依次跑：`00001_init.sql`（在 defense-simulator 里，只读）→ `m2_setup.sql`（Realtime）→ `m5_setup.sql`（最新列/RPC/备注表）。详见 `docs/BUILD.md`。
