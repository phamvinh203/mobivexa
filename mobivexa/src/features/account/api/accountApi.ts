import { apiClient } from "../../../lib/apiClient";
import { assertImageFile } from "../../../lib/validation";
import type { AuthUser } from "../../auth/types";
import type {
  Address,
  AddressPayload,
  AvatarUploadResult,
  ChangePasswordPayload,
  UpdateAddressPayload,
  UpdateProfilePayload,
} from "../types";

// Khớp src/routes/user.route.ts bên be_mobivexa — prefix /users/me (cần đăng nhập).
// Tầng api chỉ gọi HTTP thuần; đồng bộ cache là việc của tầng hook (React Query).
export const accountApi = {
  async getMe(): Promise<AuthUser> {
    const { data } = await apiClient.get<{ user: AuthUser }>("/users/me");
    return data.user;
  },

  async updateMe(payload: UpdateProfilePayload): Promise<AuthUser> {
    const { data } = await apiClient.put<{ message: string; user: AuthUser }>(
      "/users/me",
      payload,
    );
    return data.user;
  },

  async changePassword(
    payload: ChangePasswordPayload,
  ): Promise<{ message: string }> {
    const { data } = await apiClient.put<{ message: string }>(
      "/users/me/password",
      payload,
    );
    return data;
  },

  // Backend chỉ trả { avatarUrl, avatarPublicId }, không phải AuthUser đầy đủ.
  async uploadAvatar(file: File): Promise<AvatarUploadResult> {
    assertImageFile(file);
    const form = new FormData();
    form.append("avatar", file);

    const { data } = await apiClient.post<
      { message: string } & AvatarUploadResult
    >("/users/me/avatar", form);

    return { avatarUrl: data.avatarUrl, avatarPublicId: data.avatarPublicId };
  },

  // ── Addresses ──────────────────────────────────────────────────────────────

  async listAddresses(): Promise<Address[]> {
    const { data } = await apiClient.get<{ addresses: Address[] }>(
      "/users/me/addresses",
    );
    return data.addresses ?? [];
  },

  async createAddress(payload: AddressPayload): Promise<Address> {
    const { data } = await apiClient.post<{
      message: string;
      address: Address;
    }>("/users/me/addresses", payload);
    return data.address;
  },

  async updateAddress(
    id: string,
    payload: UpdateAddressPayload,
  ): Promise<Address> {
    const { data } = await apiClient.put<{ message: string; address: Address }>(
      `/users/me/addresses/${id}`,
      payload,
    );
    return data.address;
  },

  async deleteAddress(id: string): Promise<void> {
    await apiClient.delete<{ message: string }>(`/users/me/addresses/${id}`);
  },

  // Backend chỉ trả { message } — phải nạp lại danh sách để có cờ isDefault mới.
  async setDefaultAddress(id: string): Promise<void> {
    await apiClient.patch<{ message: string }>(
      `/users/me/addresses/${id}/default`,
    );
  },
};
