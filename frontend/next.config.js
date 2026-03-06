/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',       // Static export → deploy to S3
  trailingSlash: true,    // index.html for each route (S3 compatible)
  images: {
    unoptimized: true,    // S3 serves images as-is
  },
};

module.exports = nextConfig;
