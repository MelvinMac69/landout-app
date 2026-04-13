/** @type {import('next').NextConfig} */
const { execSync } = require('child_process');

let gitSha = 'unknown';
let gitBranch = 'unknown';
let gitMessage = 'unknown';
try {
  gitSha = execSync('git rev-parse --short HEAD').toString().trim();
  gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  gitMessage = execSync('git log -1 --pretty=%s').toString().trim();
} catch (e) {
  // git not available (e.g. Vercel build)
  gitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'unknown';
  gitBranch = process.env.VERCEL_GIT_COMMIT_REF || 'unknown';
  gitMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE || 'unknown';
}

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha,
    NEXT_PUBLIC_GIT_BRANCH: gitBranch,
    NEXT_PUBLIC_GIT_MESSAGE: gitMessage,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_VERCEL_URL: process.env.VERCEL_URL || '',
    NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID: process.env.VERCEL_DEPLOYMENT_ID || '',
  },
  // MapLibre GL JS is a browser library - we need to make sure it works client-side only
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
};

module.exports = nextConfig;
