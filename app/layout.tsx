import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "我的书斋",
  description: "把习惯装进书里，一本一本坚持",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
