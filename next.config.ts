import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb", // Increased from 1MB default for BIM file uploads
    },
  },
};

export default nextConfig;
