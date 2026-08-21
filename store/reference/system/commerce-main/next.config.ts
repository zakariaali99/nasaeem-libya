import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['https://tnpg.moamalat.net:6006'],
  // Enable standalone output for independent deployment
  output: 'standalone',
  // Performance and optimization settings
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  // compiler: {
  //   // Remove console logs in production
  //   removeConsole: true,
  // },
  images: {
    // Enable modern image formats
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
  poweredByHeader: false,
  eslint: {
    // Disable ESLint during production builds
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
