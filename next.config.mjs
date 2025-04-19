import path from "path";

let userConfig = undefined;
try {
  userConfig = await import("./v0-user-next.config");
} catch (e) {
  // ignore error
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export', // <-- Removed to allow dynamic API routes
  // If deploying to a subpath, set basePath and assetPrefix
  // basePath: '/your-repo-name',
  // assetPrefix: '/your-repo-name/',

  // Add eslint configuration to ignore during builds
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
