-- ============================================================================
-- M4 数据库补充（Supabase Dashboard → SQL Editor 粘贴执行一次）
--   1) habits 增加 cover 列（书封预设）
--   2) set_checkin_count：多目标打卡（某天完成 N 次，N<=0 即删除当天记录）
--   3) 重建 v_dashboard 视图：补 cover + today_count
-- 幂等，可重复执行。
-- ============================================================================

-- ① 书封
alter table public.habits
  add column if not exists cover text not null default 'linen';

-- ② 多目标打卡（替代 toggle_checkin：支持每天 N 次）
create or replace function public.set_checkin_count(
  p_habit_id uuid,
  p_count int,
  p_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select target_count into v_target
  from public.habits
  where id = p_habit_id and user_id = v_uid;

  if v_target is null then
    raise exception 'not authorized';
  end if;

  if p_count <= 0 then
    delete from public.habit_checkins
    where habit_id = p_habit_id and checkin_date = p_date;
  else
    insert into public.habit_checkins (habit_id, user_id, checkin_date, count)
    values (p_habit_id, v_uid, p_date, least(p_count, v_target))
    on conflict (habit_id, checkin_date)
    do update set count = excluded.count, updated_at = now();
  end if;
end;
$$;

grant execute on function public.set_checkin_count(uuid, int, date) to authenticated;

-- ③ 重建视图：补 cover + today_count
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
  h.cover,
  h.frequency,
  h.target_count,
  h.is_archived,
  h.created_at,
  coalesce(s.current_streak, 0) as current_streak,
  coalesce(s.longest_streak, 0) as longest_streak,
  (c.id is not null) as done_today,
  coalesce(c.count, 0) as today_count
from public.habits h
left join public.habit_streaks s on s.habit_id = h.id
left join public.habit_checkins c
  on c.habit_id = h.id and c.checkin_date = current_date;

grant select on public.v_dashboard to anon, authenticated;
