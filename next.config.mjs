/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
      bodySizeLimit: '2mb'
    }
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'worker_threads': 'worker_threads',
      }
      
      // Add rule for TypeScript worker files
      config.module.rules.push({
        test: /\.worker\.(ts|js)$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            compilerOptions: {
              module: 'CommonJS',
              target: 'ES2020',
              moduleResolution: 'node',
            },
          },
        },
      })

      // Mark Node.js built-ins as externals
      config.externals = [...(config.externals || []), 'os', 'child_process', 'util']
    }
    return config
  },
}

export default nextConfig
