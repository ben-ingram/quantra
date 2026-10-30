import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Parent folder has a stray package-lock.json with no package.json.
  // Without this, Turbopack treats C:\Users\Ben\projects as the monorepo root
  // and the RSC client manifest breaks (homepage 500s after ~60s).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
