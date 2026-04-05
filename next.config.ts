import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Parent folder also has a package-lock.json; pin Turbopack to this app root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
