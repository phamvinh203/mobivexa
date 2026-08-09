import type {
  ListQuery,
  OrderStatus,
  PaginationMeta,
  PaymentMethod,
  PaymentStatus,
} from "../../../lib/apiTypes";
import type { Money } from "../../../lib/format";

export type { OrderStatus, PaginationMeta, PaymentMethod, PaymentStatus };

export interface OrderItem {
  id: string;
  orderId: string;
  variantId: string | null;
  productName: string;
  sku: string;
  color: string | null;
  storage: string | null;
  ram: string | null;
  unitPrice: Money;
  quantity: number;
  subtotal: Money;
}

export interface Order {
  id: string;
  orderCode: string;
  userId: string;
  shippingName: string;
  shippingPhone: string;
  shippingProvince: string;
  shippingDistrict: string;
  shippingWard: string;
  shippingDetail: string;
  subtotal: Money;
  shippingFee: Money;
  discount: Money;
  total: Money;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  note: string | null;
  cancelReason: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

/** Kết quả GET /orders — listMyOrders trả kèm phân trang. */
export interface OrderListResult {
  orders: Order[];
  pagination: PaginationMeta;
}

export interface OrderListQuery extends ListQuery {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
}

// ── Metadata hiển thị ────────────────────────────────────────────────────────

type ChipColor =
  "default" | "primary" | "success" | "warning" | "error" | "info";

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; color: ChipColor }
> = {
  PENDING: { label: "Chờ xác nhận", color: "warning" },
  CONFIRMED: { label: "Đã xác nhận", color: "info" },
  SHIPPING: { label: "Đang giao", color: "primary" },
  DELIVERED: { label: "Đã giao", color: "success" },
  CANCELLED: { label: "Đã huỷ", color: "error" },
};

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; color: ChipColor }
> = {
  UNPAID: { label: "Chưa thanh toán", color: "default" },
  PAID: { label: "Đã thanh toán", color: "success" },
  REFUNDED: { label: "Đã hoàn tiền", color: "warning" },
};

export const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string }> = {
  COD: { label: "COD (nhận hàng)" },
  BANK_TRANSFER: { label: "Chuyển khoản" },
};

/** Khách chỉ được tự huỷ khi đơn chưa rời kho — khớp cancelOrder() backend. */
export function canCancelOrder(status: OrderStatus): boolean {
  return status === "PENDING" || status === "CONFIRMED";
}
