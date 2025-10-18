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
  // Exclude browser-service from builds
  webpack: (config, { isServer }) => {
    // Exclude browser-service files from webpack compilation
    config.module.rules.push({
      test: /browser-service/,
      use: 'ignore-loader'
    });
    
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'google-search-results-nodejs': 'commonjs google-search-results-nodejs'
      });
    }
    return config;
  },
}

export default nextConfig
