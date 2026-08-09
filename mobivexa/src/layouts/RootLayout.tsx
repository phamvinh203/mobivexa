import type { ReactElement } from "react";
import { Outlet } from "react-router-dom";
import { Box, Container } from "@mui/material";
import { AppHeader } from "../components/AppHeader";

export function RootLayout(): ReactElement {
  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppHeader />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
