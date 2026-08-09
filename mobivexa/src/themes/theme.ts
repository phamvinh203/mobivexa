import { createTheme, type Theme } from "@mui/material/styles";

// ─────────────────────────────────────────────────────────────────────────────
// Design token Mobivexa — bám đúng bộ biến trong fe_mobivexa/app/globals.css
// (logo Velocity Fold: teal #00BFA6, mực #101316, slate #556066).
//
// Lưu ý màu primary: teal nguyên bản của logo (#00bfa6) quá sáng để làm chữ/nút
// trên nền trắng (contrast ~2.5:1), nên primary tương tác dùng teal đậm cùng
// hue; teal sáng chỉ giữ làm accent đồ hoạ trên nền tối.
// ─────────────────────────────────────────────────────────────────────────────

/** Màu ngoài thang palette của MUI — dùng qua theme.brand trong sx. */
export interface BrandTokens {
  /** Teal nguyên bản của logo — accent trên nền tối. */
  accent: string;
  /** Nền tối: utility bar, footer, CTA — khớp tile logo. */
  ink: string;
  inkSoft: string;
  /** Flash sale (coral — cặp bổ túc của teal). */
  sale: string;
  saleStrong: string;
  /** Nhấn vàng (amber). */
  highlight: string;
}

declare module "@mui/material/styles" {
  interface Theme {
    brand: BrandTokens;
  }
  interface ThemeOptions {
    brand?: BrandTokens;
  }
}

export const theme: Theme = createTheme({
  brand: {
    accent: "#00bfa6",
    ink: "#101316",
    inkSoft: "#1a2025",
    sale: "#ff5a3c",
    saleStrong: "#e8442e",
    highlight: "#fbbf24",
  },
  palette: {
    primary: {
      main: "#0d9488",
      light: "#e4f7f4",
      dark: "#0f766e",
      contrastText: "#ffffff",
    },
    // Cyan — đối tác gradient với teal.
    secondary: { main: "#0891b2", contrastText: "#ffffff" },
    success: { main: "#10b981" },
    warning: { main: "#f59e0b" },
    error: { main: "#ef4444" },
    info: { main: "#3b82f6" },
    text: { primary: "#101316", secondary: "#556066", disabled: "#9ca3af" },
    divider: "#e5e7eb",
    background: { default: "#f2f5f6", paper: "#ffffff" },
  },
  // --radius: 0.625rem
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", system-ui, Arial, sans-serif',
    button: { textTransform: "none", fontWeight: 500 },
  },
  components: {
    // Look phẳng như fe_mobivexa: viền thay vì đổ bóng.
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});
