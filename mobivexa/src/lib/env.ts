// Nơi duy nhất đọc biến môi trường. Vite chỉ expose biến có tiền tố VITE_ vào
// bundle (xem .env) — mọi giá trị mặc định gom hết về đây để thiếu .env thì app
// vẫn chạy được.
export interface AppEnv {
  API_URL: string;
  ACCESS_TOKEN_KEY: string;
  REFRESH_TOKEN_KEY: string;
  USER_KEY: string;
}

export const env: AppEnv = {
  // Backend mặc định chạy ở :5000 — xem be_mobivexa/src/index.ts
  API_URL: import.meta.env.VITE_API_URL ?? "http://localhost:5000/api",
  // Tên key trong localStorage — xem src/lib/tokenManager.ts
  ACCESS_TOKEN_KEY:
    import.meta.env.VITE_ACCESS_TOKEN_KEY ?? "mobivexa:accessToken",
  REFRESH_TOKEN_KEY:
    import.meta.env.VITE_REFRESH_TOKEN_KEY ?? "mobivexa:refreshToken",
  USER_KEY: import.meta.env.VITE_USER_KEY ?? "mobivexa:user",
};
