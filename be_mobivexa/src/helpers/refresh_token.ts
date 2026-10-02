import prisma from '../config/db'
import { Prisma } from '../generated/prisma/client'

// Thu hồi các refresh token CÒN hiệu lực khớp `where` (id / userId / token đã hash).
// Trả PrismaPromise chưa await để nhét được vào prisma.$transaction([...]).
export function revokeRefreshTokens(where: Prisma.RefreshTokenWhereInput) {
  return prisma.refreshToken.updateMany({
    where: { ...where, isRevoked: false },
    data: { isRevoked: true },
  })
}
