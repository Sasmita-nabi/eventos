import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1", "0.0.0.0"],
  devIndicators: false,
  poweredByHeader: false,
};

export default nextConfig;
