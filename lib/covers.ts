/**
 * 书封预设 —— 低饱和马卡龙浅色（通透柔和，整体 ≤4 色）。
 * bg 用作卡片/封面浅底，accent 用作环形进度与打卡按钮高亮。
 */
export type Cover = {
  key: string;
  name: string;
  bg: string; // 浅底色
  fg: string; // 深色文字
  accent: string; // 强调色（进度环 / 按钮）
};

export const COVERS: Cover[] = [
  { key: "cream", name: "奶油米", bg: "#f7f1e6", fg: "#6b5d4f", accent: "#c9a87c" },
  { key: "mint", name: "薄荷绿", bg: "#eaf2ec", fg: "#5e7266", accent: "#8fb39a" },
  { key: "blush", name: "藕粉", bg: "#f9ecef", fg: "#7a6368", accent: "#d09aa6" },
  { key: "mist", name: "雾蓝", bg: "#eaf0f6", fg: "#5f6e80", accent: "#8fa6be" },
];

export function getCover(key: string): Cover {
  return COVERS.find((c) => c.key === key) ?? COVERS[0];
}
