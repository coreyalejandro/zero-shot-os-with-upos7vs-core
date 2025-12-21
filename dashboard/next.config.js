/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable reading from parent directory for enhancements
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;

