/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Local /public images are served as-is; no remote loaders configured.
    unoptimized: true,
  },
};

export default nextConfig;
