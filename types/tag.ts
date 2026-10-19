/**
 * 标签 —— 对应 public.tags 表。
 * 习惯↔标签 是多对多关系，由关联表 public.habit_tags (habit_id, tag_id) 表达。
 */
export type Tag = {
  id: string;
  name: string;
  color: string;
};

/** habit_tags 关联表的一行（复合主键 habit_id + tag_id）。 */
export type HabitTag = {
  habit_id: string;
  tag_id: string;
};
