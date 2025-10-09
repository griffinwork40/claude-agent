/**
 * Next.js configuration used by the application build and runtime pipelines.
 * Ensures the custom ESLint configuration does not block production builds.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Ignore ESLint during builds since we're using custom config
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
