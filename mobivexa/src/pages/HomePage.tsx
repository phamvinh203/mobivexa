import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import { useAuth } from "../features/auth/hooks/useAuth";

export function HomePage(): ReactElement {
  const { user } = useAuth();

  return (
    <Stack spacing={1}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        Mobivexa
      </Typography>
      <Typography color="text.secondary">
        {user
          ? `Xin chào, ${user.fullName}.`
          : "Đăng nhập để quản lý tài khoản của bạn."}
      </Typography>
    </Stack>
  );
}
