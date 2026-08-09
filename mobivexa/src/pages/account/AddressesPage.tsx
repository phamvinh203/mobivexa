import { useState, type ReactElement } from "react";
import { Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { Plus } from "lucide-react";
import { ErrorAlert } from "../../components/ErrorAlert";
import { AccountSectionHeader } from "../../layouts/AccountLayout";
import { AddressFormDialog } from "../../features/account/components/AddressFormDialog";
import { useAddresses } from "../../features/account/hooks/useAddresses";
import type { Address, AddressPayload } from "../../features/account/types";

function formatAddress(a: Address): string {
  return [a.streetDetail, a.ward, a.district, a.province].join(", ");
}

export function AddressesPage(): ReactElement {
  const {
    addresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  } = useAddresses();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);

  const saving = editing ? updateAddress : createAddress;

  const openCreate = (): void => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (address: Address): void => {
    setEditing(address);
    setDialogOpen(true);
  };

  const handleSubmit = (payload: AddressPayload): void => {
    const onSuccess = (): void => setDialogOpen(false);

    if (editing) {
      updateAddress.mutate({ id: editing.id, payload }, { onSuccess });
    } else {
      createAddress.mutate(payload, { onSuccess });
    }
  };

  // Thao tác hỏng (địa chỉ vừa bị xoá ở tab khác, backend 500...) phải nói ra,
  // nếu không nút chỉ tắt spinner và trông y như chưa bấm.
  const rowError = deleteAddress.error ?? setDefaultAddress.error;

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        sx={{ alignItems: "flex-start", justifyContent: "space-between" }}
      >
        <AccountSectionHeader
          title="Địa chỉ của tôi"
          description="Địa chỉ mặc định sẽ được chọn sẵn khi đặt hàng."
        />
        <Button
          variant="contained"
          onClick={openCreate}
          startIcon={<Plus size={16} />}
        >
          Thêm địa chỉ
        </Button>
      </Stack>

      <ErrorAlert error={rowError} />

      {addresses.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            Bạn chưa có địa chỉ giao hàng nào.
          </Typography>
        </Paper>
      ) : (
        addresses.map((address) => (
          <Paper key={address.id} variant="outlined" sx={{ p: 2.5 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", mb: 0.5 }}
            >
              <Typography sx={{ fontWeight: 600 }}>
                {address.fullName}
              </Typography>
              <Typography color="text.secondary">{address.phone}</Typography>
              {address.isDefault && (
                <Chip label="Mặc định" color="primary" size="small" />
              )}
            </Stack>

            <Typography color="text.secondary" sx={{ mb: 1.5 }}>
              {formatAddress(address)}
            </Typography>

            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => openEdit(address)}>
                Sửa
              </Button>

              {!address.isDefault && (
                <Button
                  size="small"
                  onClick={() => setDefaultAddress.mutate(address.id)}
                  loading={
                    setDefaultAddress.isPending &&
                    setDefaultAddress.variables === address.id
                  }
                >
                  Đặt làm mặc định
                </Button>
              )}

              <Button
                size="small"
                color="error"
                // Xoá là thao tác không hoàn tác được → hỏi lại một lần.
                onClick={() => {
                  if (window.confirm(`Xoá địa chỉ của ${address.fullName}?`)) {
                    deleteAddress.mutate(address.id);
                  }
                }}
                loading={
                  deleteAddress.isPending &&
                  deleteAddress.variables === address.id
                }
              >
                Xoá
              </Button>
            </Stack>
          </Paper>
        ))
      )}

      <AddressFormDialog
        open={dialogOpen}
        editing={editing}
        isSaving={saving.isPending}
        error={saving.error}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />
    </Stack>
  );
}
