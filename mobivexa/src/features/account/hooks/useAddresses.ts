import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
  type UseMutationResult,
} from "@tanstack/react-query";
import { accountApi } from "../api/accountApi";
import { addressesQueryOptions } from "../api/queries";
import { accountKeys } from "../api/queryKeys";
import type { Address, AddressPayload, UpdateAddressPayload } from "../types";

interface UpdateAddressVariables {
  id: string;
  payload: UpdateAddressPayload;
}

export interface UseAddressesResult {
  addresses: Address[];
  createAddress: UseMutationResult<Address, Error, AddressPayload>;
  updateAddress: UseMutationResult<Address, Error, UpdateAddressVariables>;
  deleteAddress: UseMutationResult<void, Error, string>;
  setDefaultAddress: UseMutationResult<void, Error, string>;
}

/**
 * Sổ địa chỉ giao hàng. Dùng useSuspenseQuery nên component gọi hook này phải
 * nằm trong <Suspense> — đổi lại `addresses` luôn có sẵn, không phải check
 * loading/undefined ở mọi nơi.
 *
 * Sau mỗi thao tác ghi đều invalidate cả danh sách thay vì tự sửa cache cục bộ,
 * vì backend có hiệu ứng lan sang địa chỉ khác mà client không đoán được: đặt
 * mặc định sẽ bỏ cờ của địa chỉ cũ, địa chỉ đầu tiên tự thành mặc định, và xoá
 * địa chỉ mặc định sẽ đôn địa chỉ gần nhất lên thay (xem user.service.ts).
 */
export function useAddresses(): UseAddressesResult {
  const queryClient = useQueryClient();

  // Cùng addressesQueryOptions mà route loader đã nạp → thường đọc thẳng cache,
  // không suspend lần nữa.
  const { data: addresses } = useSuspenseQuery(addressesQueryOptions);

  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: accountKeys.addresses() });
  };

  const createAddress = useMutation({
    mutationFn: (payload: AddressPayload) => accountApi.createAddress(payload),
    onSuccess: invalidate,
  });

  const updateAddress = useMutation({
    mutationFn: ({ id, payload }: UpdateAddressVariables) =>
      accountApi.updateAddress(id, payload),
    onSuccess: invalidate,
  });

  const deleteAddress = useMutation({
    mutationFn: (id: string) => accountApi.deleteAddress(id),
    onSuccess: invalidate,
  });

  const setDefaultAddress = useMutation({
    mutationFn: (id: string) => accountApi.setDefaultAddress(id),
    onSuccess: invalidate,
  });

  return {
    addresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  };
}
