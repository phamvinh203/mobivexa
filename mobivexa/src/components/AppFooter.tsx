import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import {
  BadgeCheck,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  FacebookIcon,
  InstagramIcon,
  TiktokIcon,
  YoutubeIcon,
} from "./SocialIcons";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Về Mobivexa",
    links: [
      { label: "Giới thiệu", href: "#" },
      { label: "Tuyển dụng", href: "#" },
      { label: "Tin công nghệ", href: "#" },
      { label: "Hệ thống cửa hàng", href: "#" },
    ],
  },
  {
    title: "Hỗ trợ khách hàng",
    links: [
      { label: "Hướng dẫn mua hàng", href: "#" },
      { label: "Chính sách đổi trả", href: "#" },
      { label: "Chính sách bảo hành", href: "#" },
    ],
  },
  {
    title: "Chính sách",
    links: [
      { label: "Chính sách bảo mật", href: "#" },
      { label: "Điều khoản sử dụng", href: "#" },
      { label: "Chính sách trả góp", href: "#" },
      { label: "Chính sách vận chuyển", href: "#" },
    ],
  },
];

const SOCIAL = [
  { label: "Facebook", Icon: FacebookIcon, href: "#" },
  { label: "Instagram", Icon: InstagramIcon, href: "#" },
  { label: "YouTube", Icon: YoutubeIcon, href: "#" },
  { label: "TikTok", Icon: TiktokIcon, href: "#" },
];

const TRUST = [
  { Icon: BadgeCheck, label: "Chính hãng 100%" },
  { Icon: ShieldCheck, label: "Bảo hành 12 tháng" },
  { Icon: Truck, label: "Giao nhanh 2 giờ" },
];

const PAYMENTS = ["VISA", "MASTERCARD", "MOMO", "VNPAY", "COD"];

const linkSx = {
  fontSize: 14,
  color: "rgba(255,255,255,0.55)",
  textDecoration: "none",
  transition: "color .2s",
  "&:hover": { color: "#5eead4" },
} as const;

export function AppFooter(): ReactElement {
  return (
    <Box
      component="footer"
      sx={(t) => ({
        mt: "auto",
        bgcolor: t.brand.ink,
        color: "rgba(255,255,255,0.7)",
      })}
    >
      {/* ── Brand + newsletter ───────────────────────────────────────────── */}
      <Box sx={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            sx={{
              py: 4,
              alignItems: { md: "center" },
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ maxWidth: 384 }}>
              <Box
                component={Link}
                to="/"
                aria-label="Mobivexa — Trang chủ"
                sx={{ display: "inline-block", mb: 1.5 }}
              >
                <Box
                  component="img"
                  src="/logo.svg"
                  alt="Mobivexa"
                  sx={{ height: 36, width: "auto" }}
                />
              </Box>
              <Typography sx={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
                Hệ thống bán lẻ điện thoại chính hãng. Mua sắm thông minh, sống
                đẹp hơn.
              </Typography>
            </Box>

            <Box sx={{ flex: { md: 1 }, maxWidth: { md: 448 }, width: "100%" }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                Đăng ký nhận khuyến mãi
              </Typography>
              <Stack
                component="form"
                direction="row"
                onSubmit={(e) => e.preventDefault()}
                sx={{
                  mt: 1.5,
                  p: 0.5,
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.15)",
                  bgcolor: "rgba(255,255,255,0.06)",
                  "&:focus-within": { borderColor: "#5eead4" },
                }}
              >
                <Box
                  component="input"
                  type="email"
                  placeholder="Nhập email của bạn"
                  aria-label="Email nhận khuyến mãi"
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    px: 1.5,
                    border: 0,
                    outline: "none",
                    bgcolor: "transparent",
                    fontSize: 14,
                    color: "#fff",
                    "&::placeholder": { color: "rgba(255,255,255,0.4)" },
                  }}
                />
                <Button
                  type="submit"
                  size="small"
                  sx={(t) => ({
                    borderRadius: 999,
                    px: 2,
                    color: "#fff",
                    background: `linear-gradient(90deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
                    "&:hover": { opacity: 0.9 },
                  })}
                >
                  Đăng ký
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* ── Cột liên kết ─────────────────────────────────────────────────── */}
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
            gap: 4,
            py: 5,
          }}
        >
          {COLUMNS.map((col) => (
            <Box key={col.title}>
              <Typography
                sx={{ mb: 1.5, fontSize: 14, fontWeight: 600, color: "#fff" }}
              >
                {col.title}
              </Typography>
              <Stack spacing={1.25}>
                {col.links.map((l) => (
                  <Box key={l.label} component="a" href={l.href} sx={linkSx}>
                    {l.label}
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}

          <Box>
            <Typography
              sx={{ mb: 1.5, fontSize: 14, fontWeight: 600, color: "#fff" }}
            >
              Liên hệ
            </Typography>
            <Stack
              spacing={1.25}
              sx={{ fontSize: 14, color: "rgba(255,255,255,0.55)" }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Phone size={16} aria-hidden />
                <Box component="a" href="tel:18001234" sx={linkSx}>
                  1800 1234
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Mail size={16} aria-hidden />
                support@mobivexa.com
              </Stack>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "flex-start" }}
              >
                <MapPin size={16} aria-hidden style={{ marginTop: 2 }} />
                123 Lê Lợi, Q.1, TP.HCM
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              {SOCIAL.map(({ label, Icon, href }) => (
                <Box
                  key={label}
                  component="a"
                  href={href}
                  aria-label={label}
                  title={label}
                  sx={{
                    display: "grid",
                    placeItems: "center",
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    bgcolor: "rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.7)",
                    transition: "background-color .2s, color .2s",
                    "&:hover": { bgcolor: "primary.main", color: "#fff" },
                  }}
                >
                  <Icon width={16} height={16} />
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>
      </Container>

      {/* ── Dải trust + thanh toán ───────────────────────────────────────── */}
      <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{
              py: 2,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Stack
              direction="row"
              spacing={2}
              sx={{
                flexWrap: "wrap",
                fontSize: 12,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              {TRUST.map(({ Icon, label }) => (
                <Stack
                  key={label}
                  direction="row"
                  spacing={0.75}
                  sx={{ alignItems: "center" }}
                >
                  <Icon size={16} aria-hidden />
                  {label}
                </Stack>
              ))}
            </Stack>

            <Stack direction="row" spacing={1}>
              {PAYMENTS.map((m) => (
                <Box
                  key={m}
                  sx={(t) => ({
                    borderRadius: 1,
                    bgcolor: "rgba(255,255,255,0.9)",
                    px: 0.75,
                    py: 0.5,
                    fontSize: 10,
                    fontWeight: 700,
                    color: t.brand.ink,
                  })}
                >
                  {m}
                </Box>
              ))}
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* ── Bottom bar ───────────────────────────────────────────────────── */}
      <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <Container maxWidth="lg">
          <Typography
            sx={{
              py: 2.5,
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
              textAlign: { xs: "center", sm: "left" },
            }}
          >
            © {new Date().getFullYear()} Mobivexa. Bảo lưu mọi quyền. · Đồ án
            tốt nghiệp.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
