-- ============================================================================
-- 一次性补齐数据库：让现有前端功能可用（幂等，可重复执行不报错）
-- 用法：Supabase Dashboard → SQL Editor → 粘贴整个文件 → Run
--
-- 你的库目前只跑了「初始迁移」（00001_init.sql），缺下面这些，导致：
--   创建书报错（habits 没有 cover 列）
--   打卡/备注报错（缺 set_checkin_count / set_habit_note）
--   仪表盘字段缺失（v_dashboard 缺 description/cover/created_at/today_count）
--   不实时刷新（未启用 Realtime）
-- ============================================================================

-- ① 书封列（缺失会导致「创建书」直接失败）
alter table public.habits
  add column if not exists cover text not null default 'linen';

-- ② 多目标打卡（某天完成 N 次；N <= 0 即删除当天记录）
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

-- ③ 重建仪表盘视图：补全 description / cover / created_at / today_count
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

-- ④ 「今日感受」备注表（与打卡解耦，避免 count=0 行干扰连续天数触发器）
create table if not exists public.habit_notes (
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  note_date date not null default current_date,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (habit_id, note_date)
);

alter table public.habit_notes enable row level security;

drop policy if exists "own notes" on public.habit_notes;
create policy "own notes" on public.habit_notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 保存 / 清空备注：note 为空则删除该行
create or replace function public.set_habit_note(
  p_habit_id uuid,
  p_note text,
  p_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.habits where id = p_habit_id and user_id = v_uid
  ) then
    raise exception 'not authorized';
  end if;

  if p_note is null or btrim(p_note) = '' then
    delete from public.habit_notes
    where habit_id = p_habit_id and note_date = p_date;
  else
    insert into public.habit_notes (habit_id, user_id, note_date, note)
    values (p_habit_id, v_uid, p_date, btrim(p_note))
    on conflict (habit_id, note_date)
    do update set note = excluded.note, updated_at = now();
  end if;
end;
$$;

grant execute on function public.set_habit_note(uuid, text, date) to authenticated;

-- ⑤ 启用 Realtime（让打卡 / 习惯变更实时刷新到页面；幂等，已存在则跳过）
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
