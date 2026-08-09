import {
  Suspense,
  lazy,
  useState,
  type MouseEvent,
  type ReactElement,
} from "react";
import { Link } from "react-router-dom";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { Phone } from "lucide-react";
import { useAuth } from "../features/auth/hooks/useAuth";

const AccountMenu = lazy(() =>
  import("./AccountMenu").then((m) => ({ default: m.AccountMenu })),
);

export function AppHeader(): ReactElement {
  const { user, isAuthenticated } = useAuth();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  // Chỉ nạp chunk của menu sau lần mở đầu tiên.
  const [menuLoaded, setMenuLoaded] = useState(false);

  const openMenu = (e: MouseEvent<HTMLButtonElement>): void => {
    setMenuLoaded(true);
    setAnchorEl(e.currentTarget);
  };

  return (
    <Box component="header" sx={{ position: "sticky", top: 0, zIndex: 1100 }}>
      {/* ── Utility bar ─────────────────────────────────────────────────── */}
      <Box
        sx={(t) => ({
          bgcolor: t.brand.ink,
          color: "rgba(255,255,255,0.7)",
          fontSize: 12,
        })}
      >
        <Container maxWidth="lg">
          <Stack
            direction="row"
            sx={{
              height: 36,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box
              component="span"
              sx={{ display: { xs: "none", sm: "inline" } }}
            >
              Hàng chính hãng · Bảo hành 12 tháng · Trả góp 0%
            </Box>

            <Box
              component="a"
              href="tel:18001234"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                color: "inherit",
                textDecoration: "none",
                "&:hover": { color: "#fff" },
              }}
            >
              <Phone size={14} aria-hidden />
              1800&nbsp;1234
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* ── Main bar ────────────────────────────────────────────────────── */}
      <Box
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction="row"
            spacing={2}
            sx={{ height: 68, alignItems: "center" }}
          >
            <Box
              component={Link}
              to="/"
              aria-label="Mobivexa — Trang chủ"
              sx={{
                display: "flex",
                flexShrink: 0,
                transition: "opacity .2s",
                "&:hover": { opacity: 0.9 },
              }}
            >
              <Box
                component="img"
                src="/logo1.svg"
                alt="Mobivexa"
                sx={{ height: { xs: 32, sm: 36 }, width: "auto" }}
              />
            </Box>

            <Box sx={{ flexGrow: 1 }} />

            {isAuthenticated && user ? (
              <>
                <Button
                  onClick={openMenu}
                  sx={{ gap: 1, color: "text.primary", px: 1 }}
                >
                  {/* Avatar gradient teal→cyan như bản Next.js */}
                  <Box
                    sx={(t) => ({
                      display: "grid",
                      placeItems: "center",
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fff",
                      background: `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
                    })}
                  >
                    {user.fullName.charAt(0).toUpperCase()}
                  </Box>
                  <Typography
                    component="span"
                    sx={{
                      display: { xs: "none", md: "inline" },
                      maxWidth: 112,
                      fontSize: 14,
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {user.fullName}
                  </Typography>
                </Button>

                {menuLoaded && (
                  <Suspense fallback={null}>
                    <AccountMenu
                      anchorEl={anchorEl}
                      onClose={() => setAnchorEl(null)}
                    />
                  </Suspense>
                )}
              </>
            ) : (
              <Stack direction="row" spacing={1}>
                <Button component={Link} to="/login" variant="outlined">
                  Đăng nhập
                </Button>
                <Button
                  component={Link}
                  to="/register"
                  variant="contained"
                  sx={{ display: { xs: "none", sm: "inline-flex" } }}
                >
                  Đăng ký
                </Button>
              </Stack>
            )}
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
