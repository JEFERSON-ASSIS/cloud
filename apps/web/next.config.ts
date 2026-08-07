import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@i7ai/database", "@i7ai/security", "@i7ai/types"],
  serverExternalPackages: ["bullmq", "ioredis"],
  experimental: {
    // Alinha com o teto de /configuracoes (até 5000 MB). Default do Next é 10MB.
    proxyClientMaxBodySize: "5gb",
  },
};

export default nextConfig;
