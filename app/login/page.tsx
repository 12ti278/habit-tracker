"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, LogIn } from "lucide-react";
import { login } from "@/app/auth/actions";

const inputClass =
  "w-full rounded-xl border border-line bg-white/70 px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/20";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">📚 我的书斋</h1>
          <p className="mt-1 text-sm text-ink-muted">登录你的账户</p>
        </div>

        <form action={action} className="glass p-6 sm:p-8">
          <div className="space-y-4">
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
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputClass}
              />
            </div>
          </div>

          {state?.error && (
            <p role="alert" className="mt-4 text-center text-sm text-[#b0727e]">
              {state.error}
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
              <LogIn className="h-5 w-5" />
            )}
            {pending ? "登录中..." : "登录"}
          </button>

          <p className="mt-4 text-center text-sm text-ink-muted">
            还没有账户？{" "}
            <Link
              href="/register"
              className="font-medium text-accent-strong hover:underline"
            >
              注册
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
