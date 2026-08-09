import { useState, type FormEvent, type ReactElement } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { ErrorAlert } from "../../../components/ErrorAlert";
import { PHONE_RE } from "../../../lib/validation";
import type { Address, AddressPayload } from "../types";

const EMPTY = {
  fullName: "",
  phone: "",
  province: "",
  district: "",
  ward: "",
  streetDetail: "",
};

type Fields = typeof EMPTY;

const ROWS: { key: keyof Fields; label: string }[] = [
  { key: "fullName", label: "Họ tên người nhận" },
  { key: "phone", label: "Số điện thoại" },
  { key: "province", label: "Tỉnh / Thành phố" },
  { key: "district", label: "Quận / Huyện" },
  { key: "ward", label: "Phường / Xã" },
  { key: "streetDetail", label: "Địa chỉ cụ thể" },
];

export function AddressFormDialog({
  open,
  editing,
  isSaving,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** Có giá trị = đang sửa, null = thêm mới. */
  editing: Address | null;
  isSaving: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (payload: AddressPayload) => void;
}): ReactElement {
  const [form, setForm] = useState<Fields>(EMPTY);
  const [isDefault, setIsDefault] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Nạp lại form mỗi khi mở dialog cho một địa chỉ khác. Dùng key so sánh thay
  // vì effect để không có nhịp hiển thị dữ liệu cũ.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const formKey = open ? (editing?.id ?? "new") : null;
  if (formKey !== loadedFor) {
    setLoadedFor(formKey);
    setLocalError(null);
    setForm(
      editing
        ? {
            fullName: editing.fullName,
            phone: editing.phone,
            province: editing.province,
            district: editing.district,
            ward: editing.ward,
            streetDetail: editing.streetDetail,
          }
        : EMPTY,
    );
    setIsDefault(editing?.isDefault ?? false);
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    const trimmed = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim()]),
    ) as Fields;

    if (trimmed.fullName.length < 2) {
      setLocalError("Họ tên người nhận phải có ít nhất 2 ký tự");
      return;
    }
    if (!PHONE_RE.test(trimmed.phone)) {
      setLocalError("Số điện thoại không hợp lệ (bắt đầu bằng 0 hoặc +84)");
      return;
    }
    if (
      !trimmed.province ||
      !trimmed.district ||
      !trimmed.ward ||
      !trimmed.streetDetail
    ) {
      setLocalError("Vui lòng điền đầy đủ thông tin địa chỉ");
      return;
    }

    setLocalError(null);
    // isDefault chỉ gửi khi bật — backend bỏ qua giá trị false.
    onSubmit(isDefault ? { ...trimmed, isDefault: true } : trimmed);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle>
          {editing ? "Sửa địa chỉ" : "Thêm địa chỉ mới"}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <ErrorAlert error={error} />
            {localError && <Alert severity="warning">{localError}</Alert>}

            {ROWS.map(({ key, label }) => (
              <TextField
                key={key}
                label={label}
                value={form[key]}
                onChange={(e) => {
                  const { value } = e.target;
                  setForm((prev) => ({ ...prev, [key]: value }));
                }}
                required
                fullWidth
              />
            ))}

            <FormControlLabel
              control={
                <Switch
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  // Địa chỉ đang là mặc định thì không tự bỏ cờ được: muốn đổi
                  // phải đặt địa chỉ KHÁC làm mặc định (backend bỏ qua false).
                  disabled={editing?.isDefault === true}
                />
              }
              label="Đặt làm địa chỉ mặc định"
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Huỷ</Button>
          <Button type="submit" variant="contained" loading={isSaving}>
            {editing ? "Lưu thay đổi" : "Thêm địa chỉ"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
