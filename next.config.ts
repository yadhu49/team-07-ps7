import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack rooted in this project (a package-lock.json exists in C:\Projects).
  turbopack: { root: path.resolve(__dirname) },
  // This laptop has little free memory; fewer build workers keeps the build stable.
  experimental: { cpus: 2 },
};

export default nextConfig;
