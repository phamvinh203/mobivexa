import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Path tương đối ".env.local" chỉ đúng khi chạy từ thư mục backend — chạy từ
// gốc repo (vd tooling/monorepo) thì biến im lặng trống và chỉ lỗi ở lần dùng
// đầu tiên, rất khó truy nguyên nhân. Thử cả hai vị trí và chọn file tồn tại.
const ENV_CANDIDATES = [
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), "be_mobivexa/.env.local"),
];

const envPath = ENV_CANDIDATES.find((p) => fs.existsSync(p)) ?? ENV_CANDIDATES[0];

dotenv.config({ path: envPath });

// Fail-fast lúc khởi động thay vì lỗi mù mờ ở lần truy vấn DB / webhook đầu tiên.
export function validateEnv(): void {
  if (!process.env.DATABASE_URL) {
    console.error("[Env] Thiếu DATABASE_URL — kiểm tra file .env.local");
    process.exit(1);
  }

  // Webhook SePay là endpoint public: thiếu secret ở production là lỗ hổng
  // (ai cũng giả mạo được thông báo thanh toán).
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.SEPAY_WEBHOOK_SECRET
  ) {
    console.error(
      "[Env] Thiếu SEPAY_WEBHOOK_SECRET — bắt buộc ở production để xác thực webhook SePay",
    );
    process.exit(1);
  }

  // Dịch vụ phụ: chỉ cảnh báo vì server vẫn chạy được các phần còn lại.
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[Env] Thiếu GEMINI_API_KEY — tính năng chat AI sẽ không hoạt động");
  }
  if (!process.env.CLOUDINARY_URL) {
    console.warn("[Env] Thiếu CLOUDINARY_URL — upload ảnh sẽ không hoạt động");
  }
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_PORT ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASSWORD
  ) {
    console.warn("[Env] Thiếu SMTP_* — gửi mail (đặt lại mật khẩu...) sẽ không hoạt động");
  }
}
