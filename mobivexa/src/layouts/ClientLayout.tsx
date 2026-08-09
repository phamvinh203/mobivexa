import type { ReactElement } from "react";
import { Outlet } from "react-router-dom";
import { Box, Container } from "@mui/material";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";

/** Khung trang mua sắm: navbar + nội dung + footer (tương ứng nhóm (client)
 *  bên fe_mobivexa). */
export function ClientLayout(): ReactElement {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      <AppHeader />
      <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
        <Outlet />
      </Container>
      <AppFooter />
    </Box>
  );
}
