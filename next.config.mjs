import path from "path";

let userConfig = undefined;
try {
  userConfig = await import("./v0-user-next.config");
} catch (e) {
  // ignore error
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Enable static export for GitHub Pages
  // Configure basePath and assetPrefix for GitHub Pages
  // Replace 'your-username' and 'your-repo-name' with your actual GitHub username and repository name
  basePath: process.env.NODE_ENV === 'production' ? '/JSON_Schema_Validator' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/JSON_Schema_Validator/' : '/',
  
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
