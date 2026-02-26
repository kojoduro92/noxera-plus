/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@noxera-plus/ui", "@noxera-plus/shared"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
