export interface Address {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  streetDetail: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfilePayload {
  fullName?: string;
  phone?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface AddressPayload {
  fullName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  streetDetail: string;
  /** Chỉ có tác dụng khi true — backend bỏ qua false (xem user.service.ts).
   *  Muốn gỡ mặc định thì đặt địa chỉ KHÁC làm mặc định. */
  isDefault?: true;
}

/** PUT /users/me/addresses/:id chạy qua validateAddress giống lúc tạo, tức là
 *  bắt buộc ĐỦ trường — không phải partial update. */
export type UpdateAddressPayload = AddressPayload;

/** Kết quả POST /users/me/avatar — backend chỉ select 2 field này. */
export interface AvatarUploadResult {
  avatarUrl: string;
  avatarPublicId: string;
}
