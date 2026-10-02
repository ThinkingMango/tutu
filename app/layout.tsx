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
    default: 'Little Mandala — Coloring for little hands',
    template: '%s · Little Mandala',
  },
  description:
    'A calm, tablet-first flower mandala coloring app for children ages 3 to 7, with a separate grown-up area.',
  applicationName: 'Little Mandala',
  generator: 'v0.app',
  appleWebApp: {
    capable: true,
    title: 'Little Mandala',
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
    <html lang="en" className={`${nunito.variable} bg-background`}>
      <body className="antialiased">
        {children}
        <CloudSyncRunner />
      </body>
    </html>
  )
}
