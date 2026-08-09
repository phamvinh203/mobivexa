import { queryOptions } from "@tanstack/react-query";
import { USER_SCOPED } from "../../../lib/queryClient";
import { ordersApi } from "./ordersApi";
import type { OrderListQuery } from "../types";

export const orderKeys = {
  all: ["orders"] as const,
  list: (query?: OrderListQuery) =>
    [...orderKeys.all, "list", query ?? {}] as const,
};

/** Dùng chung cho route loader (ensureQueryData) và component (useSuspenseQuery). */
export const myOrdersQueryOptions = (query?: OrderListQuery) =>
  queryOptions({
    queryKey: orderKeys.list(query),
    queryFn: () => ordersApi.listMine(query),
    meta: USER_SCOPED,
  });
