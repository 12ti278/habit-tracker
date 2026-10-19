/**
 * 仪表盘习惯行 —— 对应视图 public.v_dashboard 的一行。
 * 由服务端初始查询 + 客户端 Realtime 刷新共用。
 */
export type HabitRow = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  cover: string;
  frequency: string;
  target_count: number;
  is_archived: boolean;
  created_at: string;
  current_streak: number;
  longest_streak: number;
  done_today: boolean;
  today_count: number;
};

/** habit_checkins 的一行汇总（用于热力图 / 总打卡量）。 */
export type CheckinSummary = {
  checkin_date: string;
  count: number;
};
