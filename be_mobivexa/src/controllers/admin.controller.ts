import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import {
  listUsers,
  findUserOrThrow,
  updateUserRole,
  toggleUserStatus,
  deleteUser,
} from '../services/admin.service'

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await listUsers(req.query)
  sendSuccess(res, result)
})

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await findUserOrThrow(req.params.id as string)
  sendSuccess(res, { user })
})

export const changeUserRole = asyncHandler(async (req: Request, res: Response) => {
  const user = await updateUserRole(req.user!.userId, req.params.id as string, req.body.role)
  sendSuccess(res, { message: 'Cập nhật role thành công', user })
})

export const toggleStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = await toggleUserStatus(req.user!.userId, req.params.id as string)
  sendSuccess(res, { message: 'Cập nhật trạng thái thành công', user })
})

export const removeUser = asyncHandler(async (req: Request, res: Response) => {
  await deleteUser(req.user!.userId, req.params.id as string)
  sendSuccess(res, { message: 'Xóa người dùng thành công' })
})
