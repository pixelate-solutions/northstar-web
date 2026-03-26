/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["react-leaflet", "@react-leaflet/core"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
