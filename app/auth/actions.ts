"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type AuthState = { error?: string; success?: string } | undefined;

export async function login(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "请输入邮箱和密码" };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "邮箱或密码错误，请重试" };
  }

  redirect("/dashboard");
}

export async function signup(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();

  if (!email || !password) {
    return { error: "请输入邮箱和密码" };
  }
  if (password.length < 8) {
    return { error: "密码至少需要 8 位" };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) {
    return { error: error.message };
  }

  // 若未开启邮箱确认，注册即登录；否则提示查收验证邮件
  if (data.session) {
    redirect("/dashboard");
  }
  return { success: "注册成功！请前往邮箱完成验证后再登录。" };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
