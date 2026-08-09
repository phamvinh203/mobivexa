import type { ReactElement } from "react";
import { Link, Outlet } from "react-router-dom";
import { Box } from "@mui/material";

/** Khung tối giản cho trang xác thực: chỉ logo + nội dung canh giữa
 *  (tương ứng nhóm (auth) bên fe_mobivexa). */
export function AuthLayout(): ReactElement {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
      }}
    >
      <Box
        component="header"
        sx={{ height: 64, display: "flex", alignItems: "center", px: 3 }}
      >
        <Box component={Link} to="/" sx={{ display: "flex" }}>
          <Box
            component="img"
            src="/logo1.svg"
            alt="Mobivexa"
            sx={{ height: 32, width: "auto" }}
          />
        </Box>
      </Box>

      <Box
        component="main"
        sx={{ flex: 1, display: "grid", placeItems: "center", px: 2, py: 4 }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
