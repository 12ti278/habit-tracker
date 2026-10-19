import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DashboardClient } from "./dashboard-client";
import type { CheckinSummary, HabitRow } from "@/types/habit";
import type { HabitTag, Tag } from "@/types/tag";

export default async function DashboardPage() {
  const supabase = await createClient();

  // 真正的鉴权边界：即使绕过 proxy，这里也会拦截未登录用户
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  // 并行读取：习惯（v_dashboard 视图已聚合打卡/连续天数）+ 标签 + 关联表 + 打卡明细（热力图/总打卡量）
  // 注意 habit_tags 无 user_id，RLS 借道 habits 判断归属，故无需额外过滤
  const [habitsRes, tagsRes, habitTagsRes, checkinsRes] = await Promise.all([
    supabase
      .from("v_dashboard")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("tags")
      .select("id, name, color")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
    supabase.from("habit_tags").select("habit_id, tag_id"),
    supabase
      .from("habit_checkins")
      .select("checkin_date, count")
      .eq("user_id", user.id),
  ]);

  const displayName =
    profile?.display_name || user.email?.split("@")[0] || "朋友";

  return (
    <DashboardClient
      userId={user.id}
      displayName={displayName}
      email={profile?.email ?? user.email ?? ""}
      initialHabits={(habitsRes.data as HabitRow[]) ?? []}
      initialTags={(tagsRes.data as Tag[]) ?? []}
      initialHabitTags={(habitTagsRes.data as HabitTag[]) ?? []}
      initialCheckins={(checkinsRes.data as CheckinSummary[]) ?? []}
    />
  );
}
