import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static site: no server, nothing leaves the browser.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
