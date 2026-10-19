import { createElement, type ReactNode } from "react";
import {
  BookOpen,
  Brain,
  Check,
  Coins,
  Droplets,
  Dumbbell,
  Footprints,
  Moon,
  Music,
  PenLine,
  Pill,
  Salad,
  Sparkles,
  Sunrise,
  Target,
  type LucideIcon,
} from "lucide-react";

export type IconOption = { key: string; label: string; Icon: LucideIcon };

/** 习惯图标 —— 统一细线风格（lucide），存 key 字符串，渲染时映射回组件。 */
export const ICON_OPTIONS: IconOption[] = [
  { key: "check", label: "通用", Icon: Check },
  { key: "book-open", label: "阅读", Icon: BookOpen },
  { key: "droplets", label: "喝水", Icon: Droplets },
  { key: "footprints", label: "跑步", Icon: Footprints },
  { key: "sparkles", label: "冥想", Icon: Sparkles },
  { key: "pill", label: "吃药", Icon: Pill },
  { key: "pen-line", label: "写作", Icon: PenLine },
  { key: "target", label: "目标", Icon: Target },
  { key: "sunrise", label: "早起", Icon: Sunrise },
  { key: "dumbbell", label: "健身", Icon: Dumbbell },
  { key: "salad", label: "饮食", Icon: Salad },
  { key: "moon", label: "睡眠", Icon: Moon },
  { key: "music", label: "音乐", Icon: Music },
  { key: "brain", label: "思考", Icon: Brain },
  { key: "coins", label: "存钱", Icon: Coins },
];

const byKey = new Map(ICON_OPTIONS.map((o) => [o.key, o.Icon]));

/** 稳定组件：按 key 渲染单个图标（避免在 render 中临时创建组件）。 */
export function HabitIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}): ReactNode {
  return createElement(byKey.get(name) ?? Check, { className });
}
