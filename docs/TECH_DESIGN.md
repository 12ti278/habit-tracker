# 技术设计文档 · 个人习惯打卡系统（我的书斋）

> 对应项目：`C:\Users\OMEN\habit-tracker`（独立项目，与旧项目 `defense-simulator` 完全分离）。
> 本文档面向接手开发的工程师 / AI 编码代理，描述系统「怎么搭的」以及「为什么这么搭」。

---

## 1. 概述

「我的书斋」是一个带账号体系、以「一本书 = 一个打卡习惯」为视觉主题的个人习惯打卡 Web 应用。核心能力：

- 账号密码注册 / 登录 / 退出
- 习惯（书）的增删改查、书封与图标选择
- 每日打卡（支持「每天 N 个子任务」，即一个习惯一天可完成多次）
- 连续打卡天数（streak）实时统计
- 历史打卡日历 / 月度热力图
- 数据统计（总打卡量、最长连续、今日完成情况）
- 「今日感受」备注
- 多端实时同步（Realtime）

---

## 2. 技术选型与理由

| 层 | 选型 | 理由 |
|---|---|---|
| 前端框架 | Next.js 16（App Router）+ React 19 | RSC 服务端渲染 + Server Actions 省去自建 API 层；React 19 提供 `useActionState` 等新原语 |
| 语言 | TypeScript | 前后端类型统一，靠类型约束数据契约 |
| 样式 | Tailwind CSS v4 | CSS-first（`@import "tailwindcss"` + `@theme` 令牌），零配置，与 RSC 兼容 |
| 图标 | lucide-react | 统一细线风格，契合「通透极简」视觉 |
| 后端 / 数据库 | Supabase（Postgres） | Auth + Postgres + RLS + Realtime + RPC 一站式，免运维 |
| 认证 | Supabase Auth（email/password） | 内建会话、JWT、邮箱验证，前端 SDK 直接对接 |

> 关键：**数据层的安全边界在 Postgres RLS + security definer RPC，而不是前端。** 前端只是「乐观 UI」，所有写操作最终都经过数据库侧的归属校验。

---

## 3. 系统架构

```
┌─────────────────────────── 浏览器 ───────────────────────────┐
│  login / register / dashboard（RSC + Client Components）      │
│   - Server Component：鉴权 + 首次取数（服务端直连 Supabase）   │
│   - Client Component：持有状态 + Realtime 订阅 + 乐观更新      │
└──────────────┬──────────────────────────────┬───────────────┘
               │ HTTPS (PostgREST / RPC)      │ WebSocket (Realtime)
┌──────────────▼──────────────────────────────▼───────────────┐
│                        Supabase                              │
│  Auth (JWT) ── Postgres ── RLS 策略 ── security definer RPC   │
│                │   ├─ 表 / 视图 / 触发器                        │
│                │   └─ supabase_realtime 发布                   │
└──────────────────────────────────────────────────────────────┘
```

- **读路径**：Server Component 通过 `v_dashboard` 视图 + 各表一次性并行取数，作为初始 props 传给 Client Component。
- **写路径**：Client Component 直接调用 Server Actions（习惯/标签 CRUD）或 Supabase RPC（打卡 `set_checkin_count`、备注 `set_habit_note`）。
- **同步路径**：Client Component 订阅 `postgres_changes`，任何本用户的打卡/习惯变更都触发重新取数。

---

## 4. 数据模型（核心）

> 7 张表 + 1 视图 + 3 个 RPC。完整 DDL 见 `defense-simulator/supabase/migrations/00001_init.sql`（基础表）与 `supabase/m5_setup.sql`（后续演进）。

### 4.1 实体关系总览

```
profiles (1) ──< habits (1) ──< habit_checkins
                  │  │
                  │  └──< habit_tags >── tags (1) ──< profiles
                  │
                  └──< habit_streaks (1:1)
                  └──< habit_notes
```

### 4.2 每张表的设计与理由

#### ① `profiles` —— 用户资料（1:1 扩展 `auth.users`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid **PK，同时 FK → `auth.users(id)`** | 主键即外键 |
| `email` / `display_name` / `avatar_url` / `timezone` / `theme` | — | 业务扩展字段 |

**为什么：**
- 认证信息归 Supabase Auth 管，业务信息归 `profiles` 管，**解耦 Auth 与业务表**。
- `id` 既做主键又做外键，天然保证 1:1；`on delete cascade` 让删用户时业务数据一并清理。
- 注册时由触发器 `handle_new_user` 自动插入一行（security definer，绕过 RLS）。

#### ② `habits` —— 习惯（书）

| 字段 | 说明 |
|---|---|
| `id` | uuid PK（`gen_random_uuid()`） |
| `user_id` | **FK → `profiles(id)`**，1:N |
| `name` / `description` / `icon` / `color` / `cover` | 展示字段（图标存 key 字符串，书封存 key，颜色存 hex） |
| `frequency` | `daily/weekly/monthly`（当前只用 daily） |
| `target_count` | **每日目标次数**（N 个子任务，≥1） |
| `is_archived` | 软删除标记 |

**为什么：**
- `user_id` 加索引（`habits_user_id_idx`），支撑「查某用户全部习惯」这个最热查询。
- 删除用 `is_archived` 软删除而非物理删除，保留历史数据；仪表盘查询统一过滤 `is_archived = false`。

#### ③ `habit_checkins` —— 打卡记录（事实表）

| 字段 | 说明 |
|---|---|
| `id` | uuid PK |
| `habit_id` | **FK → `habits(id)`**，1:N，`on delete cascade` |
| `user_id` | **冗余列，FK → `profiles(id)`** |
| `checkin_date` | `date`（不是 timestamp） |
| `count` | 当天完成次数（多目标用） |
| `note` | 预留备注列（当前实际备注存在 `habit_notes`，见 4.2⑦） |

**约束：`UNIQUE (habit_id, checkin_date)`**

**为什么：**
- **事实表**：只追加「哪天打了卡、打了几次」，是 streak / 热力图 / 统计的唯一数据源。
- **`user_id` 冗余**：让 RLS 策略能直接 `auth.uid() = user_id` 判断，**免 join**；同时让「按用户 + 日期」的热查询命中单表复合索引 `checkins_user_date_idx`。
- **`UNIQUE (habit_id, checkin_date)`**：同一习惯同一天只有一行，**重复打卡只改 `count` 而不是插新行**——这正是「每天 N 个子任务」的实现基础。
- **用 `date` 而非 `timestamptz`**：业务粒度是「天」，用 date 避免时区换算把跨天打卡算错。

#### ④ `habit_streaks` —— 连续天数缓存（1:1）

| 字段 | 说明 |
|---|---|
| `habit_id` | **PK，同时 FK → `habits(id)`**（外键即主键） |
| `user_id` | 冗余列，供 RLS |
| `current_streak` / `longest_streak` | 当前 / 历史最长连续 |
| `last_checkin_date` | 最近一次打卡日 |

**为什么：**
- 1:1 关系用「外键即主键」表达，强制一个习惯只有一行缓存。
- **把 O(n) 的 streak 计算变成 O(1) 读**：连续天数由触发器在每次打卡写入后增量重算，前端只读不写（RLS 只给 select）。
- 前端读连续天数走 `v_dashboard` 视图，一次查询带出所有习惯的 streak。

#### ⑤ `tags` —— 标签

| 字段 | 说明 |
|---|---|
| `id` | uuid PK |
| `user_id` | FK → `profiles(id)` |
| `name` / `color` | 名称、颜色 |

**约束：`UNIQUE (user_id, name)`** —— 同一用户不能有同名标签。

#### ⑥ `habit_tags` —— 习惯↔标签 关联表（M:N）

| 字段 | 说明 |
|---|---|
| `habit_id` | **FK → `habits(id)`** |
| `tag_id` | **FK → `tags(id)`** |
| — | **复合主键 `(habit_id, tag_id)`** |

**为什么：**
- 经典 M:N 分解，把多对多拆成两张 1:N。
- **复合主键 `(habit_id, tag_id)` 一举两得**：既表达关联，又强制「同一习惯不能重复挂同一标签」。
- **没有 `user_id` 列**：避免关联表冗余用户信息。RLS 用 `exists` 子查询「借道 habits」判断归属（见 4.3）。

#### ⑦ `habit_notes` —— 「今日感受」备注

| 字段 | 说明 |
|---|---|
| `habit_id` | FK → `habits(id)`，`on delete cascade` |
| `user_id` | 冗余列，供 RLS |
| `note_date` | `date` |
| `note` | 备注正文 |

**主键：`(habit_id, note_date)`** —— 一个习惯一天一条备注。

**为什么独立成表（而不是复用 `habit_checkins.note`）：**
- 备注可以与「是否打卡」无关（今天没做、但想记一笔感受）。
- 若把备注塞进 `habit_checkins`，会引入 `count = 0` 的「空打卡行」，干扰 streak 触发器的计算。
- 解耦后两者互不影响，语义清晰。

### 4.3 行级安全（RLS）—— 数据隔离的根基

所有表 `enable row level security`。规则统一：

- 未登录（`auth.uid()` 为 null）→ 一律不可访问。
- 登录后 → 只能碰 `user_id = auth.uid()` 的行。
- `habit_streaks` 只读（由触发器维护，禁止直写）。
- `habit_tags`（无 `user_id`）→ `using/with check` 用 `exists(select 1 from habits where id = habit_id and user_id = auth.uid())` 借道判断归属。

> RLS 是**最后一道、也是唯一可靠的安全边界**。前端 proxy 的跳转、Server Component 的 `getUser()` 都只是「优化体验」，真正的隔离靠 RLS。

### 4.4 RPC（security definer）

| RPC | 作用 |
|---|---|
| `set_checkin_count(p_habit_id, p_count, p_date)` | 设置某天完成次数；`count ≤ 0` 删行，`count > 0` upsert（clamp 到 `target_count`） |
| `set_habit_note(p_habit_id, p_note, p_date)` | 保存/清空当日备注（空则删行） |
| `toggle_checkin(p_habit_id, p_date)` | 旧版单次打卡切换（已被 `set_checkin_count` 取代，保留兼容） |

**为什么 security definer：**
- 以函数所有者权限执行，**先在校验内部 `auth.uid()` 是否拥有该 habit**，再执行写操作——把「鉴权 + 原子写」收敛到一次数据库往返，前端调用简单且无法越权。

### 4.5 触发器

| 触发器 | 作用 |
|---|---|
| `handle_new_user` | 注册时自动创建 `profiles` 行（Auth 与业务解耦） |
| `set_updated_at` | 自动刷新 `updated_at` |
| `maintain_streak` → `recalc_streak` | 打卡表 insert/update/delete 后增量重算 streak |

### 4.6 视图 `v_dashboard`

`with (security_invoker = true)`，聚合「习惯 + 今日打卡 + streak」：

```
habits h
  left join habit_streaks s  on s.habit_id = h.id
  left join habit_checkins c on c.habit_id = h.id and c.checkin_date = current_date
```

输出 `current_streak / longest_streak / done_today / today_count / cover / target_count ...`。

**为什么 `security_invoker`：** 让视图以「调用者」身份执行，从而遵守 RLS——否则 security definer 视图会绕过 RLS 看到别人数据。

---

## 5. 认证流程

1. **注册** `signup`（Server Action）→ `supabase.auth.signUp` → 未开邮箱验证则直接登录跳 `/dashboard`，否则提示查收邮件。
2. **登录** `login` → `signInWithPassword` → `redirect("/dashboard")`。
3. **会话刷新**：`proxy.ts`（Next 16 的 middleware）在每次请求刷新 token 并写回 cookie。
4. **路由保护**：`proxy.ts` 做「乐观跳转」（未登录访问 `/dashboard` → `/login`）；真正的鉴权边界在每个 Server Component / Server Action 里的 `getUser()` + 数据库 RLS。

---

## 6. 前端架构

### 6.1 数据流模式（贯穿全站）

```
Server Component（page.tsx）
   ├─ getUser() 鉴权
   ├─ Promise.all 并行取 v_dashboard / tags / habit_tags / habit_checkins
   └─ 作为 initialXxx props 传入
        │
        ▼
Client Component（dashboard-client.tsx）
   ├─ useState 持有 initialXxx（服务端快照）
   ├─ Realtime postgres_changes → refetch() 拉最新
   ├─ 乐观更新：先改本地 state，再 RPC；失败则 refetch 回滚
   └─ 打开 BookDetail / HabitForm 弹窗
```

### 6.2 关键实现约束（React 19 新规则）

- **`react-hooks/set-state-in-effect`**：effect 里不能同步 `setState`。取数函数只返回数据，`setState` 必须放进 `.then/.catch/.finally` 回调（并配合 `cancelled` 标志做清理）。见 `book-detail.tsx`。
- **`react-hooks/static-components`**：不能在 render 里 `const Icon = getIcon(...)` 再 `<Icon/>`。用稳定的模块级组件 `<HabitIcon name=... />`（`lib/icons.ts`）。

### 6.3 视觉主题

- 「一本书 = 一个习惯」，4 种低饱和马卡龙书封（`lib/covers.ts`），整体 ≤4 色。
- 毛玻璃卡片 `.glass`（半透白 85% + blur + 16px 圆角 + 轻阴影），米杏径向渐变背景（`app/globals.css`）。
- 打卡进度用 SVG 环形进度条 `Ring`；月度热力图用共享组件 `MonthHeatmap`（单色暖棕连续色阶）。

---

## 7. 关键决策记录（ADR 摘要）

| # | 决策 | 理由 |
|---|---|---|
| 1 | 打卡事实表用 `UNIQUE(habit_id, checkin_date)` + `count` 列 | 一天一行，多目标只增 `count`，不产生冗余行 |
| 2 | `habit_checkins.user_id` 冗余 | RLS 免 join、热查询命中单表索引 |
| 3 | streak 走触发器 + 缓存表，前端只读 | 读 O(1)，计算逻辑收在数据库 |
| 4 | 备注独立成 `habit_notes` | 与打卡解耦，避免空打卡行干扰 streak |
| 5 | 写操作全部走 security definer RPC | 鉴权 + 原子写一次完成，前端无法越权 |
| 6 | 视图用 `security_invoker` | 视图遵守 RLS |
| 7 | 书封/图标存 key 字符串，渲染时映射 | 数据轻量、可扩展、可换肤 |

---

## 8. 已知现状 / 待办

- `app/page.tsx`（根路由 `/`）仍是 Next 初始化样板页，未重定向到 `/login` 或 `/dashboard`。
- 标签目前只在「新建/编辑书」表单里勾选 + 展开卡里展示，没有独立的标签管理/筛选页。
- `frequency` 字段预留了 `weekly/monthly`，但当前逻辑只实现 `daily`。
