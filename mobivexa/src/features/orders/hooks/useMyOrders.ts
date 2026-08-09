import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
  type UseMutationResult,
} from "@tanstack/react-query";
import { ordersApi } from "../api/ordersApi";
import { myOrdersQueryOptions, orderKeys } from "../api/queries";
import type { Order, OrderListQuery, PaginationMeta } from "../types";

interface CancelVariables {
  id: string;
  reason?: string;
}

export interface UseMyOrdersResult {
  orders: Order[];
  pagination: PaginationMeta;
  cancelOrder: UseMutationResult<Order, Error, CancelVariables>;
}

/** Đơn hàng của tôi. Nằm trong <Suspense> (layout /account đã bọc sẵn). */
export function useMyOrders(query?: OrderListQuery): UseMyOrdersResult {
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery(myOrdersQueryOptions(query));

  // Huỷ đơn đổi cả status lẫn tồn kho phía backend → nạp lại thay vì vá cache.
  const cancelOrder = useMutation({
    mutationFn: ({ id, reason }: CancelVariables) =>
      ordersApi.cancel(id, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });

  return { orders: data.orders, pagination: data.pagination, cancelOrder };
}
