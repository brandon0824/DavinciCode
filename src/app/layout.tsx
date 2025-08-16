import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Davinci Code Game",
  description: "Realtime card game demo",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  )
}
