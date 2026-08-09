import { Suspense, type ReactElement } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Box, Paper, Stack, Typography } from "@mui/material";
import { ListSkeleton } from "../components/ListSkeleton";

const NAV = [
  { label: "Thông tin cá nhân", to: "/account" },
  { label: "Đổi mật khẩu", to: "/account/password" },
  { label: "Địa chỉ của tôi", to: "/account/addresses" },
  { label: "Đơn hàng của tôi", to: "/account/orders" },
  { label: "Đánh giá của tôi", to: "/account/reviews" },
] as const;

export function AccountLayout(): ReactElement {
  const { pathname } = useLocation();

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "240px 1fr" },
        gap: 3,
        alignItems: "start",
      }}
    >
      <Paper variant="outlined" sx={{ p: 1 }}>
        <Stack component="nav" spacing={0.5}>
          {NAV.map((item) => {
            // "/account" là tiền tố của mọi mục khác nên phải so khớp tuyệt đối,
            // không thì nó sáng cùng lúc với mục đang mở.
            const active =
              item.to === "/account"
                ? pathname === "/account" || pathname === "/account/"
                : pathname.startsWith(item.to);

            return (
              <Box
                key={item.to}
                component={Link}
                to={item.to}
                sx={{
                  px: 2,
                  py: 1.25,
                  borderRadius: 1.5,
                  fontSize: 14,
                  textDecoration: "none",
                  color: active ? "primary.main" : "text.secondary",
                  bgcolor: active ? "primary.light" : "transparent",
                  fontWeight: active ? 600 : 400,
                  "&:hover": {
                    bgcolor: "primary.light",
                    color: "primary.main",
                  },
                }}
              >
                {item.label}
              </Box>
            );
          })}
        </Stack>
      </Paper>

      <Box component="section" sx={{ minWidth: 0 }}>
        {/* Suspense đặt ở layout, cùng tầng với guard: trang con nào dùng
            useSuspenseQuery cũng được bọc sẵn, khỏi phải nhớ tự thêm. */}
        <Suspense fallback={<ListSkeleton rows={3} />}>
          <Outlet />
        </Suspense>
      </Box>
    </Box>
  );
}

/** Tiêu đề + mô tả dùng chung cho các trang con của khu vực tài khoản. */
export function AccountSectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}): ReactElement {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      )}
    </Box>
  );
}
