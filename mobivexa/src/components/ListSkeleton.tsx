import type { ReactElement } from "react";
import { Skeleton, Stack } from "@mui/material";

/**
 * Khung xương cho danh sách. Tách riêng khỏi LoadingScreen vì LoadingScreen nằm
 * trên đường khởi động app — để chung sẽ kéo cả Skeleton của MUI vào chunk đầu
 * dù chỉ trang sổ địa chỉ mới cần.
 *
 * Chiều cao khớp thẻ nội dung thật để không bị nhảy layout khi dữ liệu về.
 */
export function ListSkeleton({ rows = 3 }: { rows?: number }): ReactElement {
  return (
    <Stack spacing={2}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={96} />
      ))}
    </Stack>
  );
}
