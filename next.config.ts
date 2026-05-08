import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/statutes-v2/:slug',
        destination: '/statutes/:slug',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
