import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@botpass/core", "@botpass/db", "@botpass/openclaw-adapter", "@botpass/config"],
  eslint: {
    ignoreDuringBuilds: true
  },
  outputFileTracingRoot: path.join(__dirname, "../..")
};

export default nextConfig;
