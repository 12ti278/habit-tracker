"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type TagActionState = { error?: string } | undefined;

export async function createTag(formData: FormData): Promise<TagActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "登录已过期，请重新登录" };

  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#94a3b8").trim() || "#94a3b8";
  if (!name) return { error: "请填写标签名称" };
  if (name.length > 20) return { error: "标签名称最多 20 个字符" };

  const { error } = await supabase.from("tags").insert({
    user_id: user.id,
    name,
    color,
  });
  if (error) {
    // 唯一约束 uq_tag_name_per_user：重名时给出友好提示
    if (error.code === "23505") return { error: "已存在同名标签" };
    return { error: "创建失败：" + error.message };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function deleteTag(formData: FormData): Promise<TagActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "登录已过期，请重新登录" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "缺少标签 ID" };

  // 级联删除会自动清掉 habit_tags 里的关联，不影响习惯本身
  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "删除失败：" + error.message };

  revalidatePath("/dashboard");
  return {};
}
