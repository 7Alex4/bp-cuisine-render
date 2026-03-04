import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Allow loading render results from any HTTPS host (n8n output URLs vary)
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

export default nextConfig
