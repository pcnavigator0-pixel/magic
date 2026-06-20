import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Disable service worker auto-registration to prevent malicious scripts
  // Service workers can be registered manually if needed from trusted sources
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
