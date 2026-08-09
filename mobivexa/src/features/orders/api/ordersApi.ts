import { apiClient } from "../../../lib/apiClient";
import type { Order, OrderListQuery, OrderListResult } from "../types";

// Khớp src/routes/order.route.ts — phần customer (/orders, cần đăng nhập).
// Backend bọc { orders, pagination } / { order } → unwrap tại đây.
export const ordersApi = {
  async listMine(query?: OrderListQuery): Promise<OrderListResult> {
    const { data } = await apiClient.get<OrderListResult>("/orders", {
      params: query,
    });
    return data;
  },

  async getMine(id: string): Promise<Order> {
    const { data } = await apiClient.get<{ order: Order }>(`/orders/${id}`);
    return data.order;
  },

  // Backend đọc body.reason (tuỳ chọn) — không truyền thì mặc định
  // "Khách hàng hủy đơn".
  async cancel(id: string, reason?: string): Promise<Order> {
    const { data } = await apiClient.patch<{ message: string; order: Order }>(
      `/orders/${id}/cancel`,
      reason ? { reason } : undefined,
    );
    return data.order;
  },
};
