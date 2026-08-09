import { useState, type FormEvent, type ReactElement } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
} from "@mui/material";
import { Eye, EyeOff } from "lucide-react";
import { ErrorAlert } from "../../components/ErrorAlert";
import { AccountSectionHeader } from "../../layouts/AccountLayout";
import { useProfile } from "../../features/account/hooks/useProfile";

/** Khớp validateChangePassword bên backend. */
const MIN_LENGTH = 8;

interface Fields {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const EMPTY: Fields = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const ROWS: { key: keyof Fields; label: string; autoComplete: string }[] = [
  {
    key: "currentPassword",
    label: "Mật khẩu hiện tại",
    autoComplete: "current-password",
  },
  { key: "newPassword", label: "Mật khẩu mới", autoComplete: "new-password" },
  {
    key: "confirmPassword",
    label: "Xác nhận mật khẩu mới",
    autoComplete: "new-password",
  },
];

export function PasswordPage(): ReactElement {
  const { changePassword } = useProfile();

  const [form, setForm] = useState<Fields>(EMPTY);
  const [visible, setVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  /** Ba luật đầu khớp backend; luật xác nhận là của riêng client (BE không nhận
   *  confirmPassword) nhưng vẫn cần để tránh gõ nhầm mà không biết. */
  const validate = (): string | null => {
    if (!form.currentPassword) return "Vui lòng nhập mật khẩu hiện tại";
    if (form.newPassword.length < MIN_LENGTH) {
      return `Mật khẩu mới phải có ít nhất ${MIN_LENGTH} ký tự`;
    }
    if (form.currentPassword === form.newPassword) {
      return "Mật khẩu mới phải khác mật khẩu hiện tại";
    }
    if (form.newPassword !== form.confirmPassword) {
      return "Xác nhận mật khẩu không khớp";
    }
    return null;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const invalid = validate();
    if (invalid) {
      setLocalError(invalid);
      return;
    }

    setLocalError(null);
    changePassword.mutate(
      {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      },
      { onSuccess: () => setForm(EMPTY) },
    );
  };

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <AccountSectionHeader
        title="Đổi mật khẩu"
        description={`Mật khẩu mới cần tối thiểu ${MIN_LENGTH} ký tự và khác mật khẩu hiện tại.`}
      />

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 440 }}>
          <ErrorAlert error={changePassword.error} />
          {localError && <Alert severity="warning">{localError}</Alert>}
          {changePassword.isSuccess && !localError && (
            <Alert severity="success">Đổi mật khẩu thành công</Alert>
          )}

          {ROWS.map(({ key, label, autoComplete }) => (
            <TextField
              key={key}
              label={label}
              type={visible ? "text" : "password"}
              value={form[key]}
              onChange={(e) => {
                const { value } = e.target;
                setForm((prev) => ({ ...prev, [key]: value }));
                setLocalError(null);
              }}
              autoComplete={autoComplete}
              required
              fullWidth
              slotProps={
                key === "currentPassword"
                  ? {
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setVisible((v) => !v)}
                              edge="end"
                              aria-label={
                                visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                              }
                            >
                              {visible ? (
                                <EyeOff size={18} aria-hidden />
                              ) : (
                                <Eye size={18} aria-hidden />
                              )}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }
                  : undefined
              }
            />
          ))}

          <Button
            type="submit"
            variant="contained"
            loading={changePassword.isPending}
            sx={{ alignSelf: "flex-start" }}
          >
            Cập nhật mật khẩu
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
