import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a phone on the same network load the dev server's scripts.
  allowedDevOrigins: ["192.168.*.*"],
};

export default nextConfig;
