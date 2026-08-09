import { useRef, useState, type FormEvent, type ReactElement } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Camera } from "lucide-react";
import { ErrorAlert } from "../../components/ErrorAlert";
import { AccountSectionHeader } from "../../layouts/AccountLayout";
import { useProfile } from "../../features/account/hooks/useProfile";
import { formatDate } from "../../lib/format";
import { PHONE_RE } from "../../lib/validation";

export function ProfilePage(): ReactElement {
  const { user, updateProfile, uploadAvatar } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  // Giá trị khởi tạo đến từ cache localStorage; getMe() chạy nền và có thể trả
  // dữ liệu mới hơn (vd sửa ở máy khác). Không đồng bộ lại thì form hiện dữ
  // liệu cũ và khi lưu sẽ ghi đè ngược lên bản mới của server.
  const [syncedAt, setSyncedAt] = useState(user?.updatedAt);
  if (user && user.updatedAt !== syncedAt) {
    setSyncedAt(user.updatedAt);
    setFullName(user.fullName);
    setPhone(user.phone ?? "");
  }

  if (!user) return <Typography>Đang tải thông tin...</Typography>;

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const name = fullName.trim();
    const tel = phone.trim();

    if (name.length < 2) {
      setLocalError("Họ tên phải có ít nhất 2 ký tự");
      return;
    }
    if (tel && !PHONE_RE.test(tel)) {
      setLocalError("Số điện thoại không hợp lệ (bắt đầu bằng 0 hoặc +84)");
      return;
    }
    // Backend từ chối khi không field nào đổi ("Vui lòng cung cấp ít nhất một
    // trường") → chặn trước cho khỏi hiện lỗi vô nghĩa.
    if (name === user.fullName && tel === (user.phone ?? "")) {
      setLocalError("Bạn chưa thay đổi thông tin nào");
      return;
    }

    setLocalError(null);
    updateProfile.mutate({ fullName: name, phone: tel || undefined });
  };

  const pickAvatar = (): void => fileRef.current?.click();

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <AccountSectionHeader
        title="Thông tin cá nhân"
        description="Quản lý thông tin hiển thị và liên hệ của bạn."
      />

      <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 3 }}>
        <Box sx={{ position: "relative" }}>
          <Avatar
            src={user.avatarUrl ?? undefined}
            alt={user.fullName}
            sx={{ width: 72, height: 72, fontSize: 28 }}
          >
            {user.fullName.charAt(0).toUpperCase()}
          </Avatar>
          <Button
            onClick={pickAvatar}
            loading={uploadAvatar.isPending}
            aria-label="Đổi ảnh đại diện"
            sx={{
              position: "absolute",
              right: -6,
              bottom: -6,
              minWidth: 0,
              width: 30,
              height: 30,
              p: 0,
              borderRadius: "50%",
              bgcolor: "primary.main",
              color: "#fff",
              "&:hover": { bgcolor: "primary.dark" },
            }}
          >
            <Camera size={15} aria-hidden />
          </Button>
          <Box
            component="input"
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (file) uploadAvatar.mutate(file);
            }}
          />
        </Box>

        <Box>
          <Typography sx={{ fontWeight: 600 }}>{user.fullName}</Typography>
          <Typography variant="body2" color="text.secondary">
            Tham gia ngày {formatDate(user.createdAt)}
          </Typography>
        </Box>
      </Stack>

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 440 }}>
          <ErrorAlert error={uploadAvatar.error} />
          <ErrorAlert error={updateProfile.error} />
          {localError && <Alert severity="warning">{localError}</Alert>}
          {updateProfile.isSuccess && !localError && (
            <Alert severity="success">Đã cập nhật thông tin</Alert>
          )}

          <TextField
            label="Email"
            value={user.email}
            disabled
            fullWidth
            helperText="Email đăng nhập không thể thay đổi"
          />

          <TextField
            label="Họ và tên"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            fullWidth
          />

          <TextField
            label="Số điện thoại"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
            placeholder="0xxxxxxxxx"
          />

          <Button
            type="submit"
            variant="contained"
            loading={updateProfile.isPending}
            sx={{ alignSelf: "flex-start" }}
          >
            Lưu thay đổi
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
