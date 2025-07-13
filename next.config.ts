import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ['image.tmdb.org'], // ← TMDBの画像を許可
  },
};

export default nextConfig;
