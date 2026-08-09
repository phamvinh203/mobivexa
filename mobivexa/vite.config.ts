/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Chỉ test module logic thuần (productQuery, variantMatrix) nên chạy môi
  // trường node — không cần jsdom, đỡ một dependency và nhanh hơn.
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
