import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import {
  listUsers,
  findUserOrThrow,
  updateUserRole,
  toggleUserStatus,
  deleteUser,
} from '../services/admin.service'

export const getUsers = asyncHandler(async (req, res) => {
  const result = await listUsers(req.query)
  sendSuccess(res, result)
})

export const getUser = asyncHandler(async (req, res) => {
  const user = await findUserOrThrow(req.params.id)
  sendSuccess(res, { user })
})

export const changeUserRole = asyncHandler(async (req, res) => {
  const user = await updateUserRole(req.user!.userId, req.params.id, req.body.role)
  sendSuccess(res, { message: 'Cập nhật role thành công', user })
})

export const toggleStatus = asyncHandler(async (req, res) => {
  const user = await toggleUserStatus(req.user!.userId, req.params.id)
  sendSuccess(res, { message: 'Cập nhật trạng thái thành công', user })
})

export const removeUser = asyncHandler(async (req, res) => {
  await deleteUser(req.user!.userId, req.params.id)
  sendSuccess(res, { message: 'Xóa người dùng thành công' })
})
