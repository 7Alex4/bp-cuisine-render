import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Allow loading render results from Supabase / Replicate HTTPS URLs.
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

export default nextConfig
