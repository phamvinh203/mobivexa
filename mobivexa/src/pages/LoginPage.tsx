import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { Box } from "@mui/material";
import { AuthCard } from "../components/AuthCard";
import { LoginForm } from "../features/auth/components/LoginForm";

export function LoginPage(): ReactElement {
  return (
    <AuthCard
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để tiếp tục mua sắm"
      footer={
        <>
          Chưa có tài khoản?{" "}
          <Box
            component={Link}
            to="/register"
            sx={{
              color: "primary.main",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Đăng ký ngay
          </Box>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
