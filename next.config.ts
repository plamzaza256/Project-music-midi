import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js dev server blocks cross-origin requests to `/_next/*` resources
  // (HMR, dev chunks) by default. Arena/E2B serves the preview under
  // `https://<port>-<sandboxId>.e2b.app`, which is a different origin — so we
  // explicitly allow the *.e2b.app host during development.
  allowedDevOrigins: ["*.e2b.app"],
};

export default nextConfig;
