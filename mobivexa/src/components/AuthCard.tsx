import type { ReactElement, ReactNode } from "react";
import { Box, Typography } from "@mui/material";

/** Khung thẻ dùng chung cho trang đăng nhập / đăng ký. */
export function AuthCard({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 448,
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 4,
        boxShadow: "0 1px 2px rgba(16,19,22,0.05)",
        p: 4,
      }}
    >
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: 14 }} color="text.secondary">
        {subtitle}
      </Typography>

      <Box sx={{ mt: 3 }}>{children}</Box>

      <Typography
        sx={{ mt: 3, fontSize: 14, textAlign: "center" }}
        color="text.secondary"
      >
        {footer}
      </Typography>
    </Box>
  );
}
