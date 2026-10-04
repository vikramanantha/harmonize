import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  devIndicators: false,
  // The dev server is reached through these public tunnels; let them use live reload.
  allowedDevOrigins: ["internalharmonized.tech", "www.internalharmonized.tech", "equate-clutter-storm.ngrok-free.dev"],
};
export default nextConfig;
