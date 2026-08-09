// Prisma serialize kiểu Decimal thành chuỗi trong JSON → giá tiền nhận về là string.
export type Money = string | number;

// Khởi tạo Intl formatter 1 lần (options cố định) — tránh dựng lại mỗi lần gọi.
const vndFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Định dạng tiền VND: 23990000 → "23.990.000₫" */
export function formatVND(value: Money): string {
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "0₫";
  return vndFormatter.format(num);
}

/** Định dạng ngày: "15/01/2024" */
export function formatDate(value: string | Date): string {
  return dateFormatter.format(
    typeof value === "string" ? new Date(value) : value,
  );
}

/** Định dạng ngày giờ: "15/01/2024 14:32" */
export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(
    typeof value === "string" ? new Date(value) : value,
  );
}
