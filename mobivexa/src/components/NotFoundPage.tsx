import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { Box, Button, Stack, Typography } from "@mui/material";

export function NotFoundPage(): ReactElement {
  return (
    <Box
      sx={{ display: "grid", placeItems: "center", minHeight: "60dvh", p: 3 }}
    >
      <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
        <Typography variant="h3" sx={{ fontWeight: 700 }} color="primary">
          404
        </Typography>
        <Typography variant="h6">Không tìm thấy trang này</Typography>
        <Typography color="text.secondary">
          Đường dẫn có thể đã đổi hoặc không còn tồn tại.
        </Typography>
        <Button component={Link} to="/" variant="contained">
          Về trang chủ
        </Button>
      </Stack>
    </Box>
  );
}
