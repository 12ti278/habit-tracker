"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

// 单色系（暖棕）由浅到深的连续色阶 —— 用于「热力」强度，仅一种色相
const RAMP = ["#efe9dd", "#e7dbc8", "#dcc7a5", "#c9a878", "#b28a50"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toKey(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function MonthHeatmap({
  values,
  cursor,
  onPrev,
  onNext,
  max,
  onCellClick,
}: {
  values: Map<string, number>;
  cursor: Date;
  onPrev: () => void;
  onNext: () => void;
  max?: number;
  onCellClick?: (dateKey: string, count: number) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - startOffset + i);
    const key = toKey(d.getFullYear(), d.getMonth(), d.getDate());
    const inMonth = d.getMonth() === month;
    const count = values.get(key) ?? 0;
    cells.push({ key, day: d.getDate(), inMonth, count });
  }

  const peak = max ?? Math.max(1, ...Array.from(values.values()));

  function level(count: number) {
    if (count <= 0) return 0;
    return Math.max(1, Math.min(4, Math.ceil((count / peak) * 4)));
  }

  const atCurrentMonth =
    year === new Date().getFullYear() && month === new Date().getMonth();

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          aria-label="上个月"
          className="rounded-full p-1.5 text-ink-muted transition hover:bg-black/5 hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-ink-soft">
          {year} 年 {month + 1} 月
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={atCurrentMonth}
          aria-label="下个月"
          className="rounded-full p-1.5 text-ink-muted transition hover:bg-black/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-[10px] text-ink-muted">
            {w}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const clickable = !!onCellClick && c.inMonth;
          const inner = (
            <>
              <span className="relative z-10">{c.day}</span>
            </>
          );
          const cls = `flex h-7 items-center justify-center rounded-md text-[11px] ${
            c.inMonth ? "text-ink-soft" : "text-transparent"
          } ${clickable ? "cursor-pointer transition hover:opacity-75" : ""}`;
          const style = {
            backgroundColor: c.inMonth ? RAMP[level(c.count)] : "transparent",
          };
          const title = `${c.key} · ${c.count}`;

          if (clickable) {
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => onCellClick!(c.key, c.count)}
                title={title}
                className={cls}
                style={style}
              >
                {inner}
              </button>
            );
          }
          return (
            <div key={c.key} title={title} className={cls} style={style}>
              {inner}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-ink-muted">
        <span>少</span>
        {RAMP.map((c) => (
          <span
            key={c}
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: c }}
          />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}
