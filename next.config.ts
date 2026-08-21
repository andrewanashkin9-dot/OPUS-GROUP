import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The hero clip is by far the heaviest thing the site serves. Next
        // serves /public with `max-age=0`, so every repeat visit revalidates
        // it; caching it hard means a returning visitor costs no transfer at
        // all, which is what keeps the hosting bill flat.
        //
        // `immutable` is a promise that the bytes at this URL never change,
        // so changing any asset in here means giving it a NEW filename
        // rather than overwriting it.
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
