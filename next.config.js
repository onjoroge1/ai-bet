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
  webpack: (config, { isServer, dev }) => {
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

    // Add mini-css-extract-plugin for CSS extraction
    if (!isServer && !dev) {
      const MiniCssExtractPlugin = require('mini-css-extract-plugin');
      config.plugins.push(new MiniCssExtractPlugin());
    }

    return config
  },
}

module.exports = nextConfig
