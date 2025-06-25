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
  output: 'standalone',
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

    // Add mini-css-extract-plugin ONLY for production builds (not development)
    if (!isServer && !dev && process.env.NODE_ENV === 'production') {
      const MiniCssExtractPlugin = require('mini-css-extract-plugin');
      config.plugins.push(new MiniCssExtractPlugin());
    }

    // Add font file handling
    config.module.rules.push({
      test: /\.(woff|woff2|eot|ttf|otf)$/i,
      type: 'asset/resource',
    })

    return config
  },
}

module.exports = nextConfig
