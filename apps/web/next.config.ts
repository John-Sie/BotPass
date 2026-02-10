import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@botpass/core", "@botpass/db", "@botpass/openclaw-adapter", "@botpass/config"],
  allowedDevOrigins: ["http://127.0.0.1:3005", "http://localhost:3005"],
  eslint: {
    ignoreDuringBuilds: true
  },
  outputFileTracingRoot: path.join(__dirname, "../..")
};

export default nextConfig;
