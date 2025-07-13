import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://snapbet.ai'
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/_next/',
          '/private/',
          '/server/',
          '/workers/',
          '/scripts/',
          '/dist/',
          '/node_modules/',
          '/.git/',
          '/.cursor/',
          '/vercel.json',
          '/package.json',
          '/tsconfig.json',
          '/jest.config.js',
          '/.eslintrc.json',
          '/.gitignore',
          '/.npmrc',
          '/pnpm-lock.yaml',
          '/package-lock.json',
          '/tsconfig.tsbuildinfo',
          '/next-env.d.ts',
          '/postcss.config.mjs',
          '/tailwind.config.ts',
          '/components.json',
          '/env.example',
          '/middleware.ts',
          '/server.ts',
          '/jest.setup.ts',
          '/tsconfig.worker.json',
          '/tsconfig.server.json',
          '/tsconfig.json',
          '/reset-prediction-data.js',
          '/reset-prediction-data.sql',
          '/test-db.js',
          '/monitor-logs.ps1',
          '/inspect-additional-markets.js',
        ]
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/_next/',
          '/private/',
        ]
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/_next/',
          '/private/',
        ]
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
} 