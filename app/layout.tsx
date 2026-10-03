import type { Metadata, Viewport } from 'next'
import { Nunito } from 'next/font/google'
import { CloudSyncRunner } from '@/components/cloud-sync-runner'
import './globals.css'

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: '小曼陀罗 — 小手涂色',
    template: '%s · 小曼陀罗',
  },
  description: '一款宁静的花朵曼陀罗涂色应用，专为 3 至 7 岁儿童设计，平板优先，并配有独立的家长区。',
  applicationName: '小曼陀罗',
  generator: 'v0.app',
  appleWebApp: {
    capable: true,
    title: '小曼陀罗',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className={`${nunito.variable} bg-background`}>
      <body className="antialiased">
        {children}
        <CloudSyncRunner />
      </body>
    </html>
  )
}
