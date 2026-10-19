import { createBrowserClient } from "@supabase/ssr";

/**
 * 浏览器端 Supabase 客户端（Client Components 使用）。
 * 会话保存在 cookie 中，由 @supabase/ssr 自动读取/写入 document.cookie。
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
