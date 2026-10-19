"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Flame,
  Loader2,
  LogOut,
  Plus,
  Settings,
  Tag as TagIcon,
  X,
} from "lucide-react";
import { BookDetail } from "./book-detail";
import { MonthHeatmap } from "./heatmap";
import { createClient } from "@/utils/supabase/client";
import { logout } from "@/app/auth/actions";
import {
  createHabit,
  deleteHabit,
  updateHabit,
} from "@/app/habits/actions";
import { createTag } from "@/app/tags/actions";
import { COVERS, getCover } from "@/lib/covers";
import { ICON_OPTIONS, HabitIcon } from "@/lib/icons";
import type { CheckinSummary, HabitRow } from "@/types/habit";
import type { HabitTag, Tag } from "@/types/tag";

// 标签配色 —— 低饱和，和书封呼应
const TAG_COLORS = [
  "#c9a87c",
  "#8fb39a",
  "#d09aa6",
  "#8fa6be",
  "#b08a5a",
  "#9a8873",
];

const inputClass =
  "w-full rounded-xl border border-line bg-white/70 px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/20";

export function DashboardClient({
  userId,
  displayName,
  email,
  initialHabits,
  initialTags,
  initialHabitTags,
  initialCheckins,
}: {
  userId: string;
  displayName: string;
  email: string;
  initialHabits: HabitRow[];
  initialTags: Tag[];
  initialHabitTags: HabitTag[];
  initialCheckins: CheckinSummary[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [habits, setHabits] = useState<HabitRow[]>(initialHabits);
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [habitTags, setHabitTags] = useState<HabitTag[]>(initialHabitTags);
  const [checkins, setCheckins] = useState<CheckinSummary[]>(initialCheckins);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitRow | null>(null);
  const [openBookId, setOpenBookId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [heatCursor, setHeatCursor] = useState(() => new Date());

  const refetch = useCallback(async () => {
    const [habitsRes, tagsRes, habitTagsRes, checkinsRes] = await Promise.all([
      supabase
        .from("v_dashboard")
        .select("*")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .order("created_at", { ascending: true }),
      supabase
        .from("tags")
        .select("id, name, color")
        .eq("user_id", userId)
        .order("name", { ascending: true }),
      supabase.from("habit_tags").select("habit_id, tag_id"),
      supabase
        .from("habit_checkins")
        .select("checkin_date, count")
        .eq("user_id", userId),
    ]);

    if (habitsRes.error) {
      setError("加载数据失败：" + habitsRes.error.message);
      return;
    }
    setHabits((habitsRes.data as HabitRow[]) ?? []);
    setTags((tagsRes.data as Tag[]) ?? []);
    setHabitTags((habitTagsRes.data as HabitTag[]) ?? []);
    setCheckins((checkinsRes.data as CheckinSummary[]) ?? []);
  }, [supabase, userId]);

  // Realtime：打卡 / 习惯 的任何变更都实时刷新
  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "habit_checkins",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refetch();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "habits",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refetch();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, refetch]);

  async function checkin(h: HabitRow) {
    const done = h.today_count >= h.target_count;
    const next = done ? 0 : Math.min(h.target_count, h.today_count + 1);
    // 乐观更新
    setHabits((prev) =>
      prev.map((x) =>
        x.id === h.id ? { ...x, today_count: next, done_today: next > 0 } : x,
      ),
    );
    const { error: err } = await supabase.rpc("set_checkin_count", {
      p_habit_id: h.id,
      p_count: next,
    });
    if (err) {
      setError("打卡失败：" + err.message);
      await refetch();
    } else {
      await refetch();
    }
  }

  async function handleCreate(fd: FormData) {
    const res = await createHabit(fd);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setCreating(false);
    await refetch();
  }

  async function handleUpdate(fd: FormData) {
    const res = await updateHabit(fd);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setEditingHabit(null);
    await refetch();
  }

  async function handleDeleteOpenBook() {
    if (!openBookId) return;
    const fd = new FormData();
    fd.set("id", openBookId);
    const res = await deleteHabit(fd);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setOpenBookId(null);
    await refetch();
  }

  async function handleCreateTag(fd: FormData) {
    const res = await createTag(fd);
    if (res?.error) {
      setError(res.error);
      return;
    }
    await refetch();
  }

  function closeForm() {
    setCreating(false);
    setEditingHabit(null);
  }

  const total = habits.length;
  const done = habits.filter((h) => h.today_count >= h.target_count).length;
  const pending = habits.filter((h) => h.today_count < h.target_count);
  const bestStreak = habits.reduce((m, h) => Math.max(m, h.longest_streak), 0);

  const totalCheckins = useMemo(
    () => checkins.reduce((s, c) => s + c.count, 0),
    [checkins],
  );

  const checkinByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of checkins) {
      m.set(c.checkin_date, (m.get(c.checkin_date) ?? 0) + c.count);
    }
    return m;
  }, [checkins]);

  // habit_id -> 标签列表
  const tagsByHabit = useMemo(() => {
    const map = new Map<string, Tag[]>();
    for (const ht of habitTags) {
      const tag = tags.find((t) => t.id === ht.tag_id);
      if (tag) {
        const list = map.get(ht.habit_id);
        if (list) list.push(tag);
        else map.set(ht.habit_id, [tag]);
      }
    }
    return map;
  }, [habitTags, tags]);

  const openBookHabit = openBookId
    ? habits.find((h) => h.id === openBookId) ?? null
    : null;

  function moveHeat(delta: number) {
    setHeatCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  return (
    <main className="min-h-screen">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-cream/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-wide">
            <span>📚</span> 我的书斋
          </span>
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-accent-strong"
              style={{ backgroundColor: "#f7f1e6" }}
              title={displayName}
            >
              {displayName.charAt(0)}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="设置"
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-black/5 hover:text-ink"
              >
                <Settings className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div className="glass absolute right-0 mt-2 w-40 p-1">
                  <form action={logout}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft transition hover:bg-black/5 hover:text-ink"
                    >
                      <LogOut className="h-4 w-4" />
                      退出登录
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* 问候 */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">你好，{displayName}</h1>
            <p className="mt-1 text-sm text-ink-muted">{email}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingHabit(null);
            }}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: "#c9a87c" }}
          >
            <Plus className="h-4 w-4" /> 添加新书
          </button>
        </div>

        {error && (
          <div className="glass mt-5 flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm text-ink-soft">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="关闭"
              className="shrink-0 text-ink-muted transition hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* 左：今日汇总 + 书架 */}
          <div className="lg:col-span-2">
            <section className="glass p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold">今日汇总</h2>
                <span className="text-sm text-ink-muted">
                  已完成 {done} / {total}
                </span>
              </div>

              {pending.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">
                  {total === 0
                    ? "书架还空着，先添加一本新书吧。"
                    : "今日全部完成，太棒了 🎉"}
                </p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {pending.map((h) => {
                    const cover = getCover(h.cover);
                    return (
                      <li
                        key={h.id}
                        className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-black/[0.03]"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: cover.accent }}
                        />
                        <button
                          type="button"
                          onClick={() => setOpenBookId(h.id)}
                          className="flex-1 truncate text-left text-sm text-ink-soft"
                        >
                          {h.name}
                        </button>
                        <span className="text-xs text-ink-muted">
                          {h.today_count}/{h.target_count}
                        </span>
                        <button
                          type="button"
                          onClick={() => void checkin(h)}
                          className="rounded-full px-3 py-1 text-xs font-medium text-white transition hover:opacity-90"
                          style={{ backgroundColor: cover.accent }}
                        >
                          打卡
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <h2 className="mt-8 text-lg font-semibold">书架</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {habits.map((h) => {
                const cover = getCover(h.cover);
                const isDone = h.today_count >= h.target_count;
                return (
                  <div
                    key={h.id}
                    role="button"
                    onClick={() => setOpenBookId(h.id)}
                    className="glass cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: cover.bg, color: cover.accent }}
                      >
                        <HabitIcon name={h.icon} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold">{h.name}</h3>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                          <Flame className="h-3 w-3" /> 连续 {h.current_streak}{" "}
                          天
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      <Ring
                        value={h.today_count}
                        total={h.target_count}
                        color={cover.accent}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void checkin(h);
                        }}
                        className="flex-1 rounded-full py-2 text-sm font-medium transition hover:opacity-90"
                        style={
                          isDone
                            ? { backgroundColor: `${cover.accent}1f`, color: cover.fg }
                            : { backgroundColor: cover.accent, color: "#fff" }
                        }
                      >
                        {isDone ? "已完成 ✓" : "打卡"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {habits.length === 0 && (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="glass flex min-h-36 flex-col items-center justify-center gap-2 text-ink-muted transition hover:text-ink-soft"
                >
                  <Plus className="h-6 w-6" />
                  <span className="text-sm">添加你的第一本书</span>
                </button>
              )}
            </div>
          </div>

          {/* 右：数据统计 */}
          <div>
            <section className="glass p-5">
              <h2 className="font-semibold">数据统计</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: "#f7f1e6" }}
                >
                  <p className="text-xs text-ink-muted">总打卡</p>
                  <p className="mt-1 text-2xl font-semibold">{totalCheckins}</p>
                </div>
                <div
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: "#eaf2ec" }}
                >
                  <p className="text-xs text-ink-muted">最长连续</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {bestStreak}
                    <span className="ml-1 text-sm font-normal text-ink-muted">
                      天
                    </span>
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium text-ink-muted">
                  月度打卡热力图
                </p>
                <MonthHeatmap
                  values={checkinByDate}
                  cursor={heatCursor}
                  onPrev={() => moveHeat(-1)}
                  onNext={() => moveHeat(1)}
                />
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* 新建 / 编辑 弹窗 */}
      {(creating || editingHabit) && (
        <Modal onClose={closeForm}>
          <HabitForm
            id={editingHabit?.id}
            tags={tags}
            selectedTagIds={
              editingHabit
                ? tagsByHabit.get(editingHabit.id)?.map((t) => t.id) ?? []
                : []
            }
            initial={
              editingHabit
                ? {
                    name: editingHabit.name,
                    description: editingHabit.description,
                    icon: editingHabit.icon,
                    cover: editingHabit.cover,
                    target_count: editingHabit.target_count,
                  }
                : undefined
            }
            submitLabel={editingHabit ? "保存" : "创建"}
            onSubmit={editingHabit ? handleUpdate : handleCreate}
            onCancel={closeForm}
            onCreateTag={handleCreateTag}
          />
        </Modal>
      )}

      {/* 打开的书 */}
      {openBookHabit && (
        <BookDetail
          habit={openBookHabit}
          tags={tagsByHabit.get(openBookHabit.id) ?? []}
          onClose={() => setOpenBookId(null)}
          onChanged={() => void refetch()}
          onEdit={() => {
            setEditingHabit(openBookHabit);
            setOpenBookId(null);
          }}
          onDelete={handleDeleteOpenBook}
        />
      )}
    </main>
  );
}

function Ring({
  value,
  total,
  color,
  size = 56,
  stroke = 6,
}: {
  value: number;
  total: number;
  color: string;
  size?: number;
  stroke?: number;
}) {
  const pct = total <= 0 ? 0 : Math.min(1, value / total);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-ink-soft">
        {value}/{total}
      </div>
    </div>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#3a322a]/25 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative mx-auto max-w-md">{children}</div>
    </div>
  );
}

type HabitFormProps = {
  initial?: {
    name: string;
    description: string;
    icon: string;
    cover: string;
    target_count: number;
  };
  id?: string;
  tags: Tag[];
  selectedTagIds?: string[];
  submitLabel: string;
  onSubmit: (fd: FormData) => Promise<void>;
  onCancel: () => void;
  onCreateTag: (fd: FormData) => Promise<void>;
};

function HabitForm({
  initial,
  id,
  tags,
  selectedTagIds,
  submitLabel,
  onSubmit,
  onCancel,
  onCreateTag,
}: HabitFormProps) {
  const [icon, setIcon] = useState(initial?.icon ?? "check");
  const [coverKey, setCoverKey] = useState(initial?.cover ?? "cream");
  const [busy, setBusy] = useState(false);
  const [addingTag, setAddingTag] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit(new FormData(e.currentTarget));
        } finally {
          setBusy(false);
        }
      }}
      className="glass p-6"
    >
      <div className="space-y-5">
        {id ? <input type="hidden" name="id" value={id} /> : null}

        <div>
          <label
            htmlFor={`name-${id ?? "new"}`}
            className="mb-1.5 block text-sm font-medium text-ink-soft"
          >
            书名
          </label>
          <input
            id={`name-${id ?? "new"}`}
            name="name"
            required
            maxLength={50}
            defaultValue={initial?.name}
            placeholder="例如：每天喝 8 杯水"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor={`desc-${id ?? "new"}`}
            className="mb-1.5 block text-sm font-medium text-ink-soft"
          >
            一句话说明（可选）
          </label>
          <input
            id={`desc-${id ?? "new"}`}
            name="description"
            maxLength={120}
            defaultValue={initial?.description}
            placeholder="这本书是关于什么的"
            className={inputClass}
          />
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label
              htmlFor={`count-${id ?? "new"}`}
              className="mb-1.5 block text-sm font-medium text-ink-soft"
            >
              每日打卡次数
            </label>
            <input
              id={`count-${id ?? "new"}`}
              name="target_count"
              type="number"
              min={1}
              max={99}
              defaultValue={initial?.target_count ?? 1}
              className={inputClass}
            />
          </div>
          <p className="pb-2.5 text-xs text-ink-muted">每天要完成的件数</p>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">
            书封
          </span>
          <input type="hidden" name="cover" value={coverKey} />
          <div className="flex flex-wrap gap-3">
            {COVERS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCoverKey(c.key)}
                aria-label={`书封 ${c.name}`}
                title={c.name}
                className="flex h-12 w-12 items-center justify-center rounded-2xl transition"
                style={{
                  backgroundColor: c.bg,
                  outline:
                    coverKey === c.key
                      ? `2px solid ${c.accent}`
                      : "1px solid #ece7dd",
                  outlineOffset: 2,
                }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: c.accent }}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">
            图标
          </span>
          <input type="hidden" name="icon" value={icon} />
          <div className="flex flex-wrap gap-1.5">
            {ICON_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setIcon(o.key)}
                title={o.label}
                aria-label={`图标 ${o.label}`}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                  icon === o.key
                    ? "border-accent bg-accent/10 text-accent-strong"
                    : "border-line bg-white/70 text-ink-soft hover:border-ink-muted"
                }`}
              >
                <o.Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-ink-soft">标签</span>
            <button
              type="button"
              onClick={() => setAddingTag((v) => !v)}
              className="flex items-center gap-1 text-xs text-ink-muted transition hover:text-ink-soft"
            >
              <TagIcon className="h-3 w-3" /> 新建标签
            </button>
          </div>

          {addingTag && (
            <div className="mb-3">
              <TagForm
                onSubmit={async (fd) => {
                  await onCreateTag(fd);
                  setAddingTag(false);
                }}
                onCancel={() => setAddingTag(false)}
              />
            </div>
          )}

          {tags.length === 0 && !addingTag ? (
            <p className="text-xs text-ink-muted">还没有标签，可先新建。</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {tags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft"
                >
                  <input
                    type="checkbox"
                    name="tag_ids"
                    value={tag.id}
                    defaultChecked={selectedTagIds?.includes(tag.id) ?? false}
                    className="h-4 w-4 rounded border-line accent-accent"
                  />
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: "#c9a87c" }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-line px-5 py-2.5 text-sm text-ink-soft transition hover:text-ink"
          >
            取消
          </button>
        </div>
      </div>
    </form>
  );
}

function TagForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (fd: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit(new FormData(e.currentTarget));
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-wrap items-center gap-2 rounded-xl bg-white/70 p-2.5"
    >
      <input
        name="name"
        required
        maxLength={20}
        placeholder="标签名称"
        className="min-w-28 flex-1 rounded-lg border border-line bg-white/70 px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-accent/60"
      />
      <input type="hidden" name="color" value={color} />
      <div className="flex items-center gap-1">
        {TAG_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`颜色 ${c}`}
            className={`h-5 w-5 rounded-full transition ${
              color === c ? "ring-2 ring-accent ring-offset-1" : "hover:scale-110"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-full px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: "#c9a87c" }}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        创建
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full px-2 py-1.5 text-xs text-ink-muted transition hover:text-ink"
      >
        取消
      </button>
    </form>
  );
}
