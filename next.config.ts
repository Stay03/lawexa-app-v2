import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/statutes-v2/:slug',
        destination: '/statutes/:slug',
        permanent: true,
      },
      {
        // Typo alias: /ambassador (singular) -> /ambassadors
        source: '/ambassador',
        destination: '/ambassadors',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        // Serve the static ambassador landing page at the clean /ambassadors URL.
        source: '/ambassadors',
        destination: '/ambassadors/index.html',
      },
    ];
  },
};

export default nextConfig;
