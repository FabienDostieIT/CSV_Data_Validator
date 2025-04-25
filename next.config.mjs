import path from "path";

let userConfig = undefined;
try {
  userConfig = await import("./v0-user-next.config");
} catch (e) {
  // ignore error
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure basePath and assetPrefix conditionally
  // Use basePath for GitHub Pages only in production & when VERCEL is not set
  basePath:
    process.env.NODE_ENV === "production" && !process.env.VERCEL
      ? "/JSON_Schema_Validator"
      : "",
  assetPrefix:
    process.env.NODE_ENV === "production" && !process.env.VERCEL
      ? "/JSON_Schema_Validator/"
      : "/",

  // Add eslint configuration to ignore during builds
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable image optimization since it requires a server
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
