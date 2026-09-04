import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["*.ngrok-free.app", "localhost", "127.0.0.1"],
};

export default nextConfig;
