import type { ReactElement } from "react";
import { Box, CircularProgress } from "@mui/material";

/** Fallback toàn trang — dùng khi chưa dựng được router (khôi phục phiên). */
export function LoadingScreen(): ReactElement {
  return (
    <Box sx={{ display: "grid", placeItems: "center", minHeight: 240 }}>
      <CircularProgress />
    </Box>
  );
}
