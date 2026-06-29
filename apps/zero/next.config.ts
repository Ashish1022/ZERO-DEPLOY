import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@zero-deploy/ui",
    "@zero-deploy/trpc",
    "@zero-deploy/database",
    "@zero-deploy/auth-backend",
    "@zero-deploy/redis",
  ],
  serverExternalPackages: ["bcryptjs", "jsonwebtoken"],
};

export default nextConfig;