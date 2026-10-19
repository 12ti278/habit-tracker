"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getCover } from "@/lib/covers";

export type HabitActionState = { error?: string } | undefined;

type ParsedHabit = {
  name: string;
  description: string;
  icon: string;
  cover: string;
  target_count: number;
};

function parseHabit(formData: FormData): ParsedHabit {
  const targetRaw = parseInt(String(formData.get("target_count") ?? "1"), 10);
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    icon: String(formData.get("icon") ?? "check").trim() || "check",
    cover: String(formData.get("cover") ?? "linen").trim() || "linen",
    target_count: Number.isFinite(targetRaw)
      ? Math.min(99, Math.max(1, targetRaw))
      : 1,
  };
}

export async function createHabit(
  formData: FormData,
): Promise<HabitActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "登录已过期，请重新登录" };

  const { name, description, icon, cover, target_count } = parseHabit(formData);
  if (!name) return { error: "请填写习惯名称" };
  if (name.length > 50) return { error: "习惯名称最多 50 个字符" };

  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: user.id,
      name,
      description,
      icon,
      cover,
      color: getCover(cover).accent,
      target_count,
    })
    .select("id")
    .single();
  if (error) return { error: "创建失败：" + error.message };

  // 关联标签（M:N，写入 habit_tags 关联表）
  const tagIds = formData.getAll("tag_ids").map(String).filter(Boolean);
  if (tagIds.length > 0) {
    const { error: tagErr } = await supabase
      .from("habit_tags")
      .insert(tagIds.map((tagId) => ({ habit_id: data.id, tag_id: tagId })));
    if (tagErr) {
      return { error: "习惯已创建，但标签保存失败：" + tagErr.message };
    }
  }

  revalidatePath("/dashboard");
  return {};
}

export async function updateHabit(
  formData: FormData,
): Promise<HabitActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "登录已过期，请重新登录" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "缺少习惯 ID" };

  const { name, description, icon, cover, target_count } = parseHabit(formData);
  if (!name) return { error: "请填写习惯名称" };

  const { error } = await supabase
    .from("habits")
    .update({
      name,
      description,
      icon,
      cover,
      color: getCover(cover).accent,
      target_count,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "保存失败：" + error.message };

  // 同步标签：先清空再重建（关联表无 user_id，靠 habit_id 定位）
  const tagIds = formData.getAll("tag_ids").map(String).filter(Boolean);
  const { error: delErr } = await supabase
    .from("habit_tags")
    .delete()
    .eq("habit_id", id);
  if (delErr) return { error: "标签同步失败：" + delErr.message };
  if (tagIds.length > 0) {
    const { error: tagErr } = await supabase
      .from("habit_tags")
      .insert(tagIds.map((tagId) => ({ habit_id: id, tag_id: tagId })));
    if (tagErr) return { error: "标签同步失败：" + tagErr.message };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function deleteHabit(
  formData: FormData,
): Promise<HabitActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "登录已过期，请重新登录" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "缺少习惯 ID" };

  // 级联删除会自动清掉该习惯的打卡记录与连续天数缓存
  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "删除失败：" + error.message };

  revalidatePath("/dashboard");
  return {};
}
