import type { ReactElement } from "react";
import { useRouteError } from "react-router-dom";
import { Box, Button, Stack, Typography } from "@mui/material";
import { extractErrorMessage } from "../lib/errorMessage";

/**
 * Màn hình lỗi cấp root (errorElement của route "/"). Cố ý KHÔNG dùng MUI Alert:
 * root nằm trên đường tải đầu tiên của mọi trang, mà Alert kéo theo Paper +
 * IconButton + SvgIcon (~20 kB gzip) cho một thứ chỉ hiện khi app hỏng.
 * Box/Typography/Button thì đã có sẵn trong chunk đầu.
 */
export function AppErrorPage(): ReactElement {
  const error = useRouteError();

  return (
    <Box
      sx={{ display: "grid", placeItems: "center", minHeight: "60dvh", p: 3 }}
    >
      <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
        <Typography variant="h6">Đã xảy ra lỗi</Typography>
        <Typography color="text.secondary">
          {extractErrorMessage(error)}
        </Typography>
        {/* react-router không có reset() cho errorElement như TanStack; tải lại
            là cách retry đáng tin nhất khi cả cây route đã ở trạng thái lỗi. */}
        <Button variant="contained" onClick={() => window.location.reload()}>
          Thử lại
        </Button>
      </Stack>
    </Box>
  );
}
