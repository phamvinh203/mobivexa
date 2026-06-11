export interface UpdateProfileBody {
  fullName?: string
  phone?: string
}

export interface ChangePasswordBody {
  currentPassword: string
  newPassword: string
}

export interface AddressBody {
  fullName: string
  phone: string
  province: string
  district: string
  ward: string
  streetDetail: string
  isDefault?: boolean
}

export type UpdateAddressBody = Partial<AddressBody>
