import path from "path";

let userConfig = undefined;
try {
  userConfig = await import("./v0-user-next.config");
} catch (e) {
  // ignore error
}

// Determine if this build is specifically for GitHub Pages static export
const isGithubPagesBuild = process.env.GITHUB_PAGES_BUILD === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure basePath and assetPrefix conditionally
  // Use basePath only for GitHub Pages builds
  basePath: isGithubPagesBuild ? "/JSON_Schema_Validator" : "",
  assetPrefix: isGithubPagesBuild ? "/JSON_Schema_Validator/" : "/",

  // Add eslint configuration to ignore during builds
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable image optimization since it requires a server
  images: {
    unoptimized: true,
  },

  // Configure build optimizations
  experimental: {
    optimizeCss: false,
    optimizePackageImports: ["react", "react-dom"],
  },

  // Include schemas/v1 in build output
  outputFileTracingIncludes: {
    "/api/list-schemas": ["./schemas/v1/**/*"],
  },

  // Increase memory limit for builds
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 4,
  },

  // TypeScript settings
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
