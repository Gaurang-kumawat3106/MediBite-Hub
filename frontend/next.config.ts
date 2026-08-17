import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
      {
        protocol: 'https',
        hostname: 'bhukkadbox.in',
      },
      {
        protocol: 'https',
        hostname: 'api.bhukkadbox.in',
      },
      {
        protocol: 'https',
        hostname: '*.onrender.com',
      }
    ],
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    return [
      {
        source: '/app/:path*',
        destination: `${backendUrl}/app/:path*`,
      },
    ];
  },
};

export default nextConfig;
