/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Production takes real payments; previews and local development use Stripe test mode.
    // Packs bought with a test card don't open in production (lib/billing/mode.ts).
    NEXT_PUBLIC_LIVE_PAYMENTS: process.env.VERCEL_ENV === 'production' ? 'true' : 'false',
  },
  images: {
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    '/api/consent/receipt': ['./public/fonts/*.otf'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // The offline helper (public/sw.js). Browsers must always fetch the newest copy of it.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig
