import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@liquid/factory", "@liquid/platformer", "@liquid/words"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
