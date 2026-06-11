import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import { AppError } from '../helpers/app_error'
import {
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../services/user.service'

// ─── Profile ──────────────────────────────────────────────────────────────────

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await getProfile(req.user!.userId)
  sendSuccess(res, { user })
})

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await updateProfile(req.user!.userId, req.body)
  sendSuccess(res, { message: 'Cập nhật thông tin thành công', user })
})

export const changeMyPassword = asyncHandler(async (req: Request, res: Response) => {
  await changePassword(req.user!.userId, req.body)
  sendSuccess(res, { message: 'Đổi mật khẩu thành công' })
})

export const uploadMyAvatar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError(400, 'Vui lòng chọn ảnh')
  const result = await uploadAvatar(req.user!.userId, req.file.buffer, req.file.mimetype)
  sendSuccess(res, { message: 'Cập nhật avatar thành công', ...result })
})

// ─── Addresses ────────────────────────────────────────────────────────────────

export const getMyAddresses = asyncHandler(async (req: Request, res: Response) => {
  const addresses = await getAddresses(req.user!.userId)
  sendSuccess(res, { addresses })
})

export const createMyAddress = asyncHandler(async (req: Request, res: Response) => {
  const address = await createAddress(req.user!.userId, req.body)
  sendSuccess(res, { message: 'Thêm địa chỉ thành công', address }, 201)
})

export const updateMyAddress = asyncHandler(async (req: Request, res: Response) => {
  const address = await updateAddress(req.user!.userId, req.params.id as string, req.body)
  sendSuccess(res, { message: 'Cập nhật địa chỉ thành công', address })
})

export const deleteMyAddress = asyncHandler(async (req: Request, res: Response) => {
  await deleteAddress(req.user!.userId, req.params.id as string)
  sendSuccess(res, { message: 'Xóa địa chỉ thành công' })
})

export const setMyDefaultAddress = asyncHandler(async (req: Request, res: Response) => {
  await setDefaultAddress(req.user!.userId, req.params.id as string)
  sendSuccess(res, { message: 'Đã đặt làm địa chỉ mặc định' })
})
