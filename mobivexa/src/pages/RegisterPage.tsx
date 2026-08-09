import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { Box } from "@mui/material";
import { AuthCard } from "../components/AuthCard";
import { RegisterForm } from "../features/auth/components/RegisterForm";

export function RegisterPage(): ReactElement {
  return (
    <AuthCard
      title="Tạo tài khoản mới"
      subtitle="Điền thông tin để bắt đầu mua sắm"
      footer={
        <>
          Đã có tài khoản?{" "}
          <Box
            component={Link}
            to="/login"
            sx={{
              color: "primary.main",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Đăng nhập
          </Box>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
