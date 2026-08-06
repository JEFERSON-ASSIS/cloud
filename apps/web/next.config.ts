import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@i7ai/database", "@i7ai/security", "@i7ai/types"],
  serverExternalPackages: ["bullmq", "ioredis"],
};
export default nextConfig;
