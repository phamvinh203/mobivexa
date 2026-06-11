import prisma from '../config/db'
import { uploadBuffer } from '../config/cloudinary'
import { Prisma } from '../generated/prisma/client'
import { AppError } from '../helpers/app_error'
import { hashPassword, verifyPassword } from '../utils/password'
import type { UpdateProfileBody, ChangePasswordBody, AddressBody, UpdateAddressBody } from '../types/user.type'

// ─── Selectors ────────────────────────────────────────────────────────────────

const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  phone: true,
  fullName: true,
  avatarUrl: true,
  role: true,
  isActive: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Lấy địa chỉ và kiểm tra quyền sở hữu — throw 404 nếu không tồn tại hoặc không thuộc về user
async function findOwnedAddress(userId: string, addressId: string) {
  const address = await prisma.address.findUnique({ where: { id: addressId } })
  if (!address || address.userId !== userId) throw new AppError(404, 'Địa chỉ không tồn tại')
  return address
}

// Bỏ cờ mặc định ở tất cả địa chỉ hiện tại của user (gọi trong transaction trước khi set default mới)
function unsetDefaultAddresses(tx: Prisma.TransactionClient, userId: string) {
  return tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export function getProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: USER_PUBLIC_SELECT,
  })
}

export async function updateProfile(userId: string, body: UpdateProfileBody) {
  const data: { fullName?: string; phone?: string | null } = {}
  if (body.fullName) data.fullName = body.fullName.trim()
  if (body.phone !== undefined) {
    if (body.phone) {
      const taken = await prisma.user.findFirst({
        where: { phone: body.phone, id: { not: userId } },
      })
      if (taken) throw new AppError(409, 'Số điện thoại đã được sử dụng')
    }
    data.phone = body.phone || null
  }

  return prisma.user.update({
    where: { id: userId },
    data,
    select: USER_PUBLIC_SELECT,
  })
}

export async function changePassword(userId: string, body: ChangePasswordBody) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.passwordHash) throw new AppError(400, 'Tài khoản không dùng mật khẩu')

  const valid = await verifyPassword(body.currentPassword, user.passwordHash)
  if (!valid) throw new AppError(400, 'Mật khẩu hiện tại không đúng')

  const passwordHash = await hashPassword(body.newPassword)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } })
}

export async function uploadAvatar(userId: string, buffer: Buffer, mimetype: string) {
  // public_id cố định + overwrite => ảnh mới luôn thay thế ảnh cũ tại chỗ, không cần xóa thủ công
  const uploadResult = await uploadBuffer(buffer, {
    folder: 'users/avatars',
    public_id: `user_${userId}`,
    overwrite: true,
    resource_type: 'image',
    format: mimetype === 'image/png' ? 'png' : 'webp',
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
  })

  return prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: uploadResult.secure_url, avatarPublicId: uploadResult.public_id },
    select: { avatarUrl: true, avatarPublicId: true },
  })
}

// ─── Addresses ────────────────────────────────────────────────────────────────

export function getAddresses(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function createAddress(userId: string, body: AddressBody) {
  const { isDefault, ...fields } = body

  // Nếu chưa có địa chỉ nào thì tự động set làm mặc định
  const existing = await prisma.address.findFirst({ where: { userId }, select: { id: true } })
  const shouldBeDefault = isDefault || existing === null

  if (shouldBeDefault) {
    return prisma.$transaction(async (tx) => {
      await unsetDefaultAddresses(tx, userId)
      return tx.address.create({ data: { ...fields, userId, isDefault: true } })
    })
  }

  return prisma.address.create({ data: { ...fields, userId, isDefault: false } })
}

export async function updateAddress(userId: string, addressId: string, body: UpdateAddressBody) {
  const address = await findOwnedAddress(userId, addressId)
  const { isDefault, ...fields } = body

  if (isDefault && !address.isDefault) {
    return prisma.$transaction(async (tx) => {
      await unsetDefaultAddresses(tx, userId)
      return tx.address.update({ where: { id: addressId }, data: { ...fields, isDefault: true } })
    })
  }

  return prisma.address.update({ where: { id: addressId }, data: fields })
}

export async function deleteAddress(userId: string, addressId: string) {
  const address = await findOwnedAddress(userId, addressId)

  await prisma.address.delete({ where: { id: addressId } })

  // Nếu xóa địa chỉ mặc định, tự động set địa chỉ gần nhất làm mặc định
  if (address.isDefault) {
    const next = await prisma.address.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    if (next) {
      await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } })
    }
  }
}

export async function setDefaultAddress(userId: string, addressId: string) {
  const address = await findOwnedAddress(userId, addressId)
  if (address.isDefault) return // đã là mặc định, không cần làm gì

  await prisma.$transaction(async (tx) => {
    await unsetDefaultAddresses(tx, userId)
    await tx.address.update({ where: { id: addressId }, data: { isDefault: true } })
  })
}
