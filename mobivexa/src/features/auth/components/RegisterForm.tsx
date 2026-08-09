import { useState, type FormEvent, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Stack, TextField } from "@mui/material";
import { ErrorAlert } from "../../../components/ErrorAlert";
import { useAuth } from "../hooks/useAuth";

// Khớp validateRegister bên backend (auth.validator.ts).
const MIN_PASSWORD_LENGTH = 8;

export function RegisterForm(): ReactElement {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    register.mutate(
      // phone là tuỳ chọn — gửi undefined thay vì chuỗi rỗng để backend bỏ qua.
      { fullName, email, password, phone: phone.trim() || undefined },
      // Đăng ký không trả token nên trạng thái auth không đổi, không có guard
      // nào tự chuyển trang — ở đây phải tự điều hướng.
      { onSuccess: () => navigate("/login") },
    );
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Stack spacing={2}>
        <ErrorAlert error={register.error} />

        <TextField
          label="Họ và tên"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          required
          fullWidth
        />

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          autoComplete="email"
          required
          fullWidth
        />

        <TextField
          label="Số điện thoại"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          fullWidth
          helperText="Không bắt buộc"
        />

        <TextField
          label="Mật khẩu"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          fullWidth
          slotProps={{ htmlInput: { minLength: MIN_PASSWORD_LENGTH } }}
          helperText={`Tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`}
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          loading={register.isPending}
          fullWidth
          sx={{ height: 48 }}
        >
          Đăng ký
        </Button>
      </Stack>
    </Box>
  );
}
