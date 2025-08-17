import "./globals.css";

export const metadata = {
  title: '达芬奇密码 - 游戏房间管理系统',
  description: '一个现代化的游戏房间管理系统',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
