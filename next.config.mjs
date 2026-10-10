/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [],
  },
  experimental: {
    serverComponentsExternalPackages: [
      "fluent-ffmpeg",
      "@ffmpeg-installer/ffmpeg",
      "@ffprobe-installer/ffprobe",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push(
        "fluent-ffmpeg",
        "@ffmpeg-installer/ffmpeg",
        "@ffprobe-installer/ffprobe"
      );
    }
    return config;
  },
};

export default nextConfig;
