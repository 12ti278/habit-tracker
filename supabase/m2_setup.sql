-- ============================================================================
-- M2 数据库补充（在 Supabase Dashboard → SQL Editor 中粘贴执行一次即可）
--   1) 启用 Realtime：让前端实时刷新打卡 / 习惯变更
--   2) 给仪表盘视图补上 description + created_at（编辑回显 + 按创建时间排序）
-- 幂等：可重复执行，不会重复添加或报错。
-- ============================================================================

-- ① 启用 Realtime（幂等：已存在则跳过）
do $$
declare
  t text;
begin
  foreach t in array array['habits', 'habit_checkins', 'habit_streaks'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ② 重建视图：补上 description 与 created_at
create or replace view public.v_dashboard
with (security_invoker = true)
as
select
  h.id,
  h.user_id,
  h.name,
  h.description,
  h.icon,
  h.color,
  h.frequency,
  h.target_count,
  h.is_archived,
  h.created_at,
  coalesce(s.current_streak, 0) as current_streak,
  coalesce(s.longest_streak, 0) as longest_streak,
  (c.id is not null) as done_today
from public.habits h
left join public.habit_streaks s on s.habit_id = h.id
left join public.habit_checkins c
  on c.habit_id = h.id and c.checkin_date = current_date;

grant select on public.v_dashboard to anon, authenticated;
