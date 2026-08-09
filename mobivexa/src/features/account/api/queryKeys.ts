/** Query key tập trung — tránh gõ chuỗi rải rác rồi lệch nhau khi invalidate. */
export const accountKeys = {
  all: ["account"] as const,
  addresses: () => [...accountKeys.all, "addresses"] as const,
};
