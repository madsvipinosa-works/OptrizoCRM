import type { NextConfig } from "next";

// Force Restart: Attempt 3 (Fix Syntax Error)

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;
