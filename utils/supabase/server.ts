import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 服务端 Supabase 客户端（Server Components / Server Actions 使用）。
 *
 * - 每个请求都要新建一个 client，切勿跨请求复用。
 * - `cookies()` 在 Next.js 16 是异步的，必须 await。
 * - token 刷新由 proxy.ts 写回响应，这里忽略 setAll 的 headers 参数。
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components 中无法写 cookie，正常忽略；刷新由 proxy.ts 负责
          }
        },
      },
    },
  );
}
