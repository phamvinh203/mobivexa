/** Query key tập trung — tránh gõ chuỗi rải rác rồi lệch nhau khi invalidate. */
export const authKeys = {
  all: ["auth"] as const,
  currentUser: () => [...authKeys.all, "me"] as const,
};
