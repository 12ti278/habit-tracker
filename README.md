# 我的书斋 · Habit Tracker

一个把「习惯」做成「书」的个人习惯打卡 Web 应用。每养成一个习惯，就是往书斋里放一本书；每天打卡，就是翻开书页、留下一点记录。

## 功能

- 📚 **书斋书架**：每个习惯是一本书，支持自定义书名、书封配色与图标
- ✅ **每日打卡**：一天可多次打卡，记录当日完成次数
- 🔥 **连续天数**：打卡后自动维护连续天数（streak）
- 🗓️ **打卡热力图**：以月历热力图查看历史记录
- 📝 **每日备注**：为某天的打卡单独写备注，与打卡数据解耦
- 🏷️ **标签分类**：给习惯打标签，按标签筛选
- ⚡ **实时同步**：基于 Supabase Realtime，多端数据自动刷新
- 🔐 **账号体系**：邮箱注册 / 登录 / 退出，数据通过 RLS 隔离，只有本人可见

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | Next.js 16（App Router、Server Actions） |
| UI | React 19 + Tailwind CSS v4 + lucide-react |
| 后端 / 数据库 | Supabase（PostgreSQL + Auth + Realtime） |
| 语言 | TypeScript |
| 部署 | Netlify |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

> ⚠️ `NEXT_PUBLIC_SUPABASE_URL` 只填到 `.supabase.co` 为止，**不要带 `/rest/v1/` 后缀**，否则注册会报错。

### 3. 初始化数据库

在 Supabase Dashboard 的 SQL Editor 中，依次执行：

1. `supabase/m2_setup.sql` —— 启用 Realtime 并补充视图字段
2. `supabase/m5_setup.sql` —— 书封、打卡/备注 RPC 等最终版结构

> 所有 SQL 都是幂等的，可重复执行。从零建库还需先执行基础表结构脚本，完整顺序见 [docs/BUILD.md](docs/BUILD.md)。

### 4. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000 ，会自动跳转到登录页。

## 目录结构

```
app/
├── page.tsx                # 根路由，重定向到 /login
├── login/ · register/      # 登录、注册
├── dashboard/              # 书架、今日汇总、统计、热力图、书详情
├── habits/ · tags/         # 习惯与标签的 Server Actions
└── auth/actions.ts         # 登录 / 注册 / 退出
lib/                        # 书封配色、图标映射
types/                      # Habit / Tag 类型定义
utils/supabase/             # 服务端 / 浏览器 Supabase 客户端
supabase/                   # 数据库迁移 SQL
proxy.ts                    # Next.js 16 中间件：会话刷新 + 路由保护
```

## 文档

- [本地构建与环境配置](docs/BUILD.md)
- [技术设计说明](docs/TECH_DESIGN.md)

## 部署

项目适配 Netlify / Vercel 等平台。部署时在平台环境变量中配置 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 即可，`.env.local` 不会提交到仓库。

```bash
npm run build
npm start
```
