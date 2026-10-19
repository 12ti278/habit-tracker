"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, UserPlus } from "lucide-react";
import { signup } from "@/app/auth/actions";

const inputClass =
  "w-full rounded-xl border border-line bg-white/70 px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/20";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">📚 创建账户</h1>
          <p className="mt-1 text-sm text-ink-muted">开始记录你的习惯</p>
        </div>

        <form action={action} className="glass p-6 sm:p-8">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="display_name"
                className="mb-1.5 block text-sm font-medium text-ink-soft"
              >
                昵称（可选）
              </label>
              <input
                id="display_name"
                name="display_name"
                type="text"
                placeholder="怎么称呼你"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-ink-soft"
              >
                邮箱
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-ink-soft"
              >
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="至少 8 位"
                className={inputClass}
              />
            </div>
          </div>

          {state?.error && (
            <p role="alert" className="mt-4 text-center text-sm text-[#b0727e]">
              {state.error}
            </p>
          )}
          {state?.success && (
            <p role="status" className="mt-4 text-center text-sm text-ink-soft">
              {state.success}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full py-3 text-base font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: "#c9a87c" }}
          >
            {pending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UserPlus className="h-5 w-5" />
            )}
            {pending ? "注册中..." : "注册"}
          </button>

          <p className="mt-4 text-center text-sm text-ink-muted">
            已有账户？{" "}
            <Link
              href="/login"
              className="font-medium text-accent-strong hover:underline"
            >
              登录
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
