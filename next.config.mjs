/** @type {import('next').NextConfig} */
const backendInternalUrl =
  process.env.BACKEND_INTERNAL_URL?.trim().replace(/\/+$/, '') || 'http://localhost:8080'
const allowedDevOrigins = (
  process.env.NEXT_ALLOWED_DEV_ORIGINS || '*.tunnelmole.net,*.tunnelmole.com'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.vercel-insights.com https://vercel.live https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss: ws: http://localhost:* http://127.0.0.1:*",
              "frame-ancestors 'self'",
              "form-action 'self'",
              "base-uri 'self'",
            ].join('; '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
          {
            key: 'X-Powered-By',
            value: '',
          },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendInternalUrl}/api/:path*`,
      },
      {
        source: '/ws-native',
        destination: `${backendInternalUrl}/ws-native`,
      },
      {
        source: '/ws-native/:path*',
        destination: `${backendInternalUrl}/ws-native/:path*`,
      },
      {
        source: '/ws',
        destination: `${backendInternalUrl}/ws`,
      },
      {
        source: '/ws/:path*',
        destination: `${backendInternalUrl}/ws/:path*`,
      },
    ]
  },
}

export default nextConfig
