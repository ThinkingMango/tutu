import type { MetadataRoute } from 'next'

/** Lets families add 漫涂涂 to a tablet's home screen, where it opens full screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '漫涂涂',
    short_name: '漫涂涂',
    description: '为 3 至 7 岁儿童打造的宁静花朵曼陀罗涂色应用。',
    lang: 'zh-CN',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
