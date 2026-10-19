"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flame, Loader2, Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getCover } from "@/lib/covers";
import { HabitIcon } from "@/lib/icons";
import { MonthHeatmap, toKey } from "./heatmap";
import type { HabitRow } from "@/types/habit";
import type { Tag } from "@/types/tag";

export function BookDetail({
  habit,
  tags,
  onClose,
  onChanged,
  onEdit,
  onDelete,
}: {
  habit: HabitRow;
  tags: Tag[];
  onClose: () => void;
  onChanged: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const cover = getCover(habit.cover);

  const todayKey = useMemo(() => {
    const now = new Date();
    return toKey(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const [checkins, setCheckins] = useState<Map<string, number>>(new Map());
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cursor, setCursor] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const fetchCheckins = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("habit_checkins")
      .select("checkin_date, count")
      .eq("habit_id", habit.id);
    if (err) throw err;
    const map = new Map<string, number>();
    for (const row of data ?? []) {
      map.set(row.checkin_date, row.count);
    }
    return map;
  }, [supabase, habit.id]);

  const fetchNote = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("habit_notes")
      .select("note")
      .eq("habit_id", habit.id)
      .eq("note_date", todayKey)
      .maybeSingle();
    if (err) throw err;
    return data?.note ?? "";
  }, [supabase, habit.id, todayKey]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCheckins(), fetchNote()])
      .then(([m, noteStr]) => {
        if (!cancelled) {
          setCheckins(m);
          setNote(noteStr);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError("加载失败：" + e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchCheckins, fetchNote]);

  async function setCountOnDate(key: string, next: number) {
    const clamped = Math.max(0, Math.min(habit.target_count, next));
    setCheckins((prev) => {
      const m = new Map(prev);
      if (clamped <= 0) m.delete(key);
      else m.set(key, clamped);
      return m;
    });
    const { error: err } = await supabase.rpc("set_checkin_count", {
      p_habit_id: habit.id,
      p_count: clamped,
      p_date: key,
    });
    if (err) {
      setError("操作失败：" + err.message);
      try {
        setCheckins(await fetchCheckins());
      } catch (e) {
        setError((e as Error).message);
      }
    } else {
      onChanged();
    }
  }

  async function saveNote() {
    setSavingNote(true);
    setNoteSaved(false);
    const { error: err } = await supabase.rpc("set_habit_note", {
      p_habit_id: habit.id,
      p_note: note,
      p_date: todayKey,
    });
    setSavingNote(false);
    if (err) setError("保存失败：" + err.message);
    else setNoteSaved(true);
  }

  const totalCheckins = useMemo(() => {
    let s = 0;
    for (const c of checkins.values()) s += c;
    return s;
  }, [checkins]);

  function move(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#3a322a]/25 p-4 backdrop-blur-sm sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="glass overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center gap-4 p-6" style={{ backgroundColor: cover.bg }}>
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/60"
              style={{ color: cover.accent }}
            >
              <HabitIcon name={habit.icon} className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-semibold" style={{ color: cover.fg }}>
                {habit.name}
              </h2>
              <p className="mt-0.5 flex items-center gap-1 text-sm" style={{ color: cover.fg, opacity: 0.75 }}>
                <Flame className="h-3.5 w-3.5" /> 连续 {habit.current_streak} 天 · 最长{" "}
                {habit.longest_streak} 天
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="rounded-full p-2 transition hover:bg-black/10"
              style={{ color: cover.fg }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {error && (
              <p
                role="alert"
                className="mb-4 rounded-xl bg-black/[0.04] px-4 py-2 text-sm text-ink-soft"
              >
                {error}
              </p>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {/* 左：历史打卡记录 */}
              <section>
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">历史打卡</h3>
                  <span className="text-xs text-ink-muted">
                    累计 {totalCheckins} 次
                  </span>
                </div>
                {loading ? (
                  <div className="mt-8 flex h-48 items-center justify-center text-ink-muted">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <div className="mt-3">
                    <MonthHeatmap
                      values={checkins}
                      cursor={cursor}
                      onPrev={() => move(-1)}
                      onNext={() => move(1)}
                      max={habit.target_count}
                      onCellClick={(key, count) =>
                        setCountOnDate(key, count > 0 ? 0 : habit.target_count)
                      }
                    />
                    <p className="mt-2 text-xs text-ink-muted">
                      点击日期补卡 / 取消
                    </p>
                  </div>
                )}
              </section>

              {/* 右：今日感受 + 标签 + 操作 */}
              <section className="flex flex-col">
                <h3 className="font-semibold">今日感受</h3>
                <textarea
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setNoteSaved(false);
                  }}
                  rows={5}
                  placeholder="今天感觉如何？"
                  className="mt-3 w-full resize-none rounded-xl border border-line bg-white/70 px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-accent/60"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={saveNote}
                    disabled={savingNote}
                    className="rounded-full px-4 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: cover.accent }}
                  >
                    {savingNote ? "保存中..." : "保存感受"}
                  </button>
                  {noteSaved && (
                    <span className="text-xs text-ink-muted">已保存 ✓</span>
                  )}
                </div>

                {tags.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-medium text-ink-muted">标签</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {tags.map((t) => (
                        <span
                          key={t.id}
                          className="flex items-center gap-1 rounded-full border border-line bg-white/70 px-2.5 py-1 text-xs text-ink-soft"
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: t.color }}
                          />
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-auto flex gap-2 pt-5">
                  <button
                    type="button"
                    onClick={onEdit}
                    className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-ink-soft transition hover:bg-black/5"
                  >
                    <Pencil className="h-3.5 w-3.5" /> 编辑
                  </button>
                  {confirmDelete ? (
                    <>
                      <button
                        type="button"
                        onClick={onDelete}
                        className="rounded-full px-4 py-2 text-xs font-medium text-white transition hover:opacity-90"
                        style={{ backgroundColor: "#d09aa6" }}
                      >
                        确认删除
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="rounded-full px-3 py-2 text-xs text-ink-muted transition hover:text-ink"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition hover:bg-black/5"
                      style={{ color: "#b0727e" }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> 删除
                    </button>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
