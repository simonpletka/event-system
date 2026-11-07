import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a phone on the same network load the dev server's scripts.
  allowedDevOrigins: ["192.168.*.*"],
  experimental: {
    serverActions: {
      // Expense receipts go through a server action and may be up to 8MB;
      // the default cap is 1MB. The form's other fields need a little room.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
