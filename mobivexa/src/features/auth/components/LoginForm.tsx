import { useState, type FormEvent, type ReactElement } from "react";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { ErrorAlert } from "../../../components/ErrorAlert";
import { useAuth } from "../hooks/useAuth";
import { useRateLimit } from "../hooks/useRateLimit";

export function LoginForm(): ReactElement {
  const { login } = useAuth();
  const { cooldown, blocked, registerFailure, reset } = useRateLimit();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Đăng nhập xong KHÔNG tự navigate: auth đổi → router invalidate → beforeLoad
  // của /login thấy đã đăng nhập và tự đưa về ?redirect. Tự gọi navigate ở đây
  // sẽ chạy trước lúc React kịp render nên guard vẫn đọc auth cũ.
  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (blocked) return;

    login.mutate(
      { email, password },
      { onSuccess: reset, onError: registerFailure },
    );
  };

  const busy = login.isPending || login.isSuccess;

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Stack spacing={2}>
        <ErrorAlert error={login.error} />

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
          label="Mật khẩu"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mật khẩu"
          autoComplete="current-password"
          required
          fullWidth
          helperText={
            // Backend đã có /auth/forgot-password nhưng SPA này chưa dựng trang
            // đó — hiện nhắc suông thay vì link tới route không tồn tại.
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
            >
              Quên mật khẩu? Liên hệ 1800 1234 để được hỗ trợ.
            </Typography>
          }
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          // Giữ spinner cả khi đã thành công: lúc đó guard đang chuyển trang,
          // tắt spinner sẽ nháy một nhịp như thể bấm hụt.
          loading={busy}
          disabled={blocked}
          fullWidth
          sx={{ height: 48 }}
        >
          {blocked ? `Thử lại sau ${cooldown}s` : "Đăng nhập"}
        </Button>
      </Stack>
    </Box>
  );
}
