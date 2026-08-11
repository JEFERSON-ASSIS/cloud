import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@i7ai/database", "@i7ai/security", "@i7ai/types"],
  serverExternalPackages: ["bullmq", "ioredis"],
  experimental: {
    // Arquivos grandes são enviados em blocos de 8 MB; nenhum request precisa carregar o arquivo inteiro.
    proxyClientMaxBodySize: "16mb",
  },
};

export default nextConfig;
