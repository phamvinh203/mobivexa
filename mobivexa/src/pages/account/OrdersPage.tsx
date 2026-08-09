import type { ReactElement } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { ErrorAlert } from "../../components/ErrorAlert";
import { AccountSectionHeader } from "../../layouts/AccountLayout";
import { useMyOrders } from "../../features/orders/hooks/useMyOrders";
import {
  ORDER_STATUS_META,
  PAYMENT_METHOD_META,
  PAYMENT_STATUS_META,
  canCancelOrder,
  type Order,
} from "../../features/orders/types";
import { formatDateTime, formatVND } from "../../lib/format";

function OrderCard({
  order,
  onCancel,
  isCancelling,
}: {
  order: Order;
  onCancel: (id: string) => void;
  isCancelling: boolean;
}): ReactElement {
  const status = ORDER_STATUS_META[order.status];
  const payment = PAYMENT_STATUS_META[order.paymentStatus];

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", flexWrap: "wrap", mb: 1 }}
      >
        <Typography sx={{ fontWeight: 700 }}>#{order.orderCode}</Typography>
        <Chip label={status.label} color={status.color} size="small" />
        <Chip
          label={payment.label}
          color={payment.color}
          size="small"
          variant="outlined"
        />
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {formatDateTime(order.createdAt)}
        </Typography>
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      <Stack spacing={1}>
        {order.items.map((item) => (
          <Stack
            key={item.id}
            direction="row"
            spacing={1}
            sx={{ alignItems: "baseline" }}
          >
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
              {item.productName}
              {(item.color ?? item.storage) && (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                >
                  {" "}
                  (
                  {[item.color, item.storage, item.ram]
                    .filter(Boolean)
                    .join(" / ")}
                  )
                </Typography>
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ×{item.quantity}
            </Typography>
            <Typography
              variant="body2"
              sx={{ minWidth: 96, textAlign: "right" }}
            >
              {formatVND(item.subtotal)}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        <Typography variant="body2" color="text.secondary">
          {PAYMENT_METHOD_META[order.paymentMethod].label}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Typography sx={{ fontWeight: 700 }} color="primary">
          {formatVND(order.total)}
        </Typography>
        {canCancelOrder(order.status) && (
          <Button
            size="small"
            color="error"
            loading={isCancelling}
            onClick={() => {
              if (window.confirm(`Huỷ đơn #${order.orderCode}?`)) {
                onCancel(order.id);
              }
            }}
          >
            Huỷ đơn
          </Button>
        )}
      </Stack>

      {order.cancelReason && (
        <Typography
          variant="caption"
          color="error"
          sx={{ mt: 1, display: "block" }}
        >
          Lý do huỷ: {order.cancelReason}
        </Typography>
      )}
    </Paper>
  );
}

export function OrdersPage(): ReactElement {
  const { orders, pagination, cancelOrder } = useMyOrders();

  return (
    <Stack spacing={2}>
      <AccountSectionHeader
        title="Đơn hàng của tôi"
        description={
          pagination.total > 0
            ? `Bạn có ${pagination.total} đơn hàng.`
            : undefined
        }
      />

      <ErrorAlert error={cancelOrder.error} />

      {orders.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            Bạn chưa có đơn hàng nào.
          </Typography>
        </Paper>
      ) : (
        orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onCancel={(id) => cancelOrder.mutate({ id })}
            isCancelling={
              cancelOrder.isPending && cancelOrder.variables?.id === order.id
            }
          />
        ))
      )}
    </Stack>
  );
}
