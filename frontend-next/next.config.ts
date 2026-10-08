import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents / partialPrefetching are off: every page loads its data in
  // the browser with a token from localStorage, so there is nothing to cache on
  // the server, and antd's style registry generates ids during render, which
  // Cache Components refuses to prerender.
};

export default nextConfig;
