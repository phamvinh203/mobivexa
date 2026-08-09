import { queryOptions } from "@tanstack/react-query";
import { USER_SCOPED } from "../../../lib/queryClient";
import { accountApi } from "./accountApi";
import { accountKeys } from "./queryKeys";

/**
 * Khai báo query một lần, dùng được ở cả hai phía:
 *  - route `loader` gọi ensureQueryData() để nạp trước khi render
 *  - component gọi useSuspenseQuery() và đọc luôn cache đã ấm
 *
 * Đây là cách TanStack Router và TanStack Query nối với nhau; tách rời hai nơi
 * sẽ khiến key/queryFn dễ lệch nhau.
 */
export const addressesQueryOptions = queryOptions({
  queryKey: accountKeys.addresses(),
  queryFn: () => accountApi.listAddresses(),
  meta: USER_SCOPED,
});
