import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['ccxt', 'node-cron'],
};

export default nextConfig;
