/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Ignore ESLint during builds since we're using custom config
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
