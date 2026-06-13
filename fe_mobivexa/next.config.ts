import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chỉ định rõ workspace root để tránh Next.js nhận nhầm khi có nhiều
  // package-lock.json trên máy (ví dụ C:\Users\Admin\package-lock.json).
  turbopack: {
    root: __dirname,
  },

  // Cho phép next/image tải ảnh từ backend. CHỈNH hostname/port cho khớp
  // nơi backend serve ảnh sản phẩm trước khi lên production.
  images: {
    // placehold.co (logo brand) trả SVG — cần bật dangerouslyAllowSVG.
    // CSP sandbox ngăn script trong SVG chạy.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "5000", pathname: "/**" },
      // Ảnh sản phẩm crawl từ cellphones.com.vn
      { protocol: "https", hostname: "cdn.cellphones.com.vn", pathname: "/**" },
      { protocol: "https", hostname: "cdn2.cellphones.com.vn", pathname: "/**" },
      // Logo brand placeholder (seed)
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
      // Wikipedia logo (dev seed data)
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/**" },
      // Ví dụ production (bỏ comment + sửa đúng domain CDN/storage):
      // { protocol: "https", hostname: "cdn.mobivexa.com", pathname: "/**" },
    ],
  },

  // Security headers cơ bản — chống clickjacking, MIME sniffing, rò rỉ referrer.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
