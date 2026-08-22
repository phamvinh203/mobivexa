import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { CouponType } from '../generated/prisma/client'
import { checkId, checkQuantity } from './common.validator'

// Export để validateCreateOrder dùng đúng bộ luật này, không dựng literal thứ hai.
// Trần độ dài và hình thức mã phải là MỘT nguồn sự thật: ba cổng (tạo mã, preview,
// đặt hàng) mà mỗi cổng một con số thì mã lọt được cổng này lại chết ở cổng kia.
export const MAX_CODE_LENGTH = 32
export const CODE_RE = new RegExp(`^[A-Z0-9_-]{3,${MAX_CODE_LENGTH}}$`)

// Các cột schema khai NOT NULL, kèm nhãn tiếng Việt để dựng thông báo lỗi.
// Cột nullable (description, maxDiscount, usageLimit) CỐ Ý không có mặt: gửi null
// lên chúng là thao tác xoá hợp lệ, đó là cách duy nhất admin gỡ trần giảm hay bỏ
// giới hạn lượt dùng.
const REQUIRED_LABELS: Record<string, string> = {
  code:          'Mã giảm giá',
  type:          'Loại mã giảm giá',
  value:         'Giá trị giảm',
  minOrderValue: 'Giá trị đơn tối thiểu',
  startsAt:      'Thời gian bắt đầu',
  endsAt:        'Thời gian kết thúc',
  isActive:      'Trạng thái',
}

// Kiểm tra chung cho create và update. `partial` bật lên khi update — field không
// gửi lên thì bỏ qua, field có gửi thì vẫn phải đúng.
function validateBody(req: Request, res: Response, partial: boolean): boolean {
  const b = req.body ?? {}
  const has = (k: string) => b[k] !== undefined && b[k] !== null

  // Chặn null trên cột NOT NULL TRƯỚC mọi kiểm tra khác, vì has() coi null như
  // vắng mặt nên toàn bộ nhánh bên dưới sẽ né đúng những field này. {startsAt:null}
  // từng lọt qua đây rồi thành new Date(null) = 1970-01-01 — một Date HỢP LỆ chứ
  // không phải NaN — nên Prisma nhận, và mã hẹn lịch thành dùng được ngay.
  for (const [key, label] of Object.entries(REQUIRED_LABELS)) {
    if (b[key] === null) {
      sendError(res, 400, `${label} không được để trống`)
      return false
    }
  }

  if (!partial || has('code')) {
    if (typeof b.code !== 'string' || !CODE_RE.test(b.code.trim().toUpperCase())) {
      sendError(res, 400, 'Mã chỉ gồm chữ, số, gạch ngang và gạch dưới, dài 3-32 ký tự')
      return false
    }
  }

  if (!partial || has('type')) {
    if (!Object.values(CouponType).includes(b.type)) {
      sendError(res, 400, 'Loại mã giảm giá không hợp lệ')
      return false
    }
  }

  // Mọi field số đều GHI NGƯỢC giá trị đã ép kiểu vào body — cùng lối với
  // parseIntField (common.validator.ts). Chỉ kiểm tra Number(x) rồi để tầng dưới
  // ghi x thô là hai giá trị khác nhau: Number(true) = 1 lọt qua mọi vòng kiểm,
  // rồi boolean rơi thẳng vào cột Decimal và Prisma ném 500.
  if (!partial || has('value')) {
    const value = Number(b.value)
    if (!Number.isFinite(value) || value <= 0) {
      sendError(res, 400, 'Giá trị giảm phải là số dương')
      return false
    }
    if (b.type === CouponType.PERCENT && value > 100) {
      sendError(res, 400, 'Giảm theo phần trăm không được vượt quá 100')
      return false
    }
    b.value = value
  }

  // Trần giảm chỉ có nghĩa với PERCENT. Báo lỗi chứ không bỏ qua im lặng: admin
  // đặt trần cho mã tiền cố định là đang hiểu nhầm, để họ tưởng đã đặt được thì
  // tệ hơn là báo ngay.
  if (has('maxDiscount')) {
    if (b.type === CouponType.FIXED) {
      sendError(res, 400, 'Mã giảm số tiền cố định không có trần giảm')
      return false
    }
    const max = Number(b.maxDiscount)
    if (!Number.isFinite(max) || max <= 0) {
      sendError(res, 400, 'Trần giảm phải là số dương')
      return false
    }
    b.maxDiscount = max
  }

  if (has('minOrderValue')) {
    const min = Number(b.minOrderValue)
    if (!Number.isFinite(min) || min < 0) {
      sendError(res, 400, 'Giá trị đơn tối thiểu không được là số âm')
      return false
    }
    b.minOrderValue = min
  }

  if (has('usageLimit')) {
    const limit = Number(b.usageLimit)
    if (!Number.isInteger(limit) || limit <= 0) {
      sendError(res, 400, 'Giới hạn lượt dùng phải là số nguyên dương')
      return false
    }
    b.usageLimit = limit
  }

  // description và isActive từng lọt lưới: REQUIRED_LABELS chặn được null nhưng
  // không ai soi KIỂU, mà couponData ghi thẳng chúng xuống. {"isActive":"false"}
  // hay {"description":123} đi trọn tới Prisma rồi nổ PrismaClientValidationError
  // thành 500 — lỗi của client mà báo như hệ thống hỏng.
  //
  // Dùng has() (bỏ qua null) chứ không `!partial || ...`: cả hai đều KHÔNG bắt
  // buộc lúc tạo — description nullable, isActive có @default(true) trong schema.
  if (has('description') && typeof b.description !== 'string') {
    sendError(res, 400, 'Mô tả mã giảm giá phải là chuỗi ký tự')
    return false
  }

  if (has('isActive') && typeof b.isActive !== 'boolean') {
    sendError(res, 400, 'Trạng thái phải là true hoặc false')
    return false
  }

  // Hai mốc thời gian được kiểm RIÊNG, mỗi mốc chỉ khi có gửi lên. Gộp chung một
  // cổng như trước là body vá lẻ một mốc ăn 400 oan: PUT {endsAt} — gia hạn một
  // đợt khuyến mãi đang chạy, thao tác sửa mã thường gặp nhất — cho ra
  // new Date(undefined) = Invalid Date ở mốc VẮNG MẶT, rồi báo "Thời gian áp dụng
  // không hợp lệ" về một cái ngày admin gửi lên hoàn toàn đúng.
  const starts = !partial || has('startsAt') ? new Date(b.startsAt) : null
  const ends   = !partial || has('endsAt')   ? new Date(b.endsAt)   : null

  if ((starts && Number.isNaN(starts.getTime())) || (ends && Number.isNaN(ends.getTime()))) {
    sendError(res, 400, 'Thời gian áp dụng không hợp lệ')
    return false
  }

  // Chỉ so được khi CÓ ĐỦ cặp ngay trong body. Body vá lẻ thì nửa còn lại của cặp
  // nằm dưới DB mà middleware không đọc được — luật thứ tự cho ca đó nằm ở
  // updateCoupon (coupon.service.ts), nơi bản ghi đã có sẵn trong tay.
  if (starts && ends && ends <= starts) {
    sendError(res, 400, 'Thời gian kết thúc phải sau thời gian bắt đầu')
    return false
  }

  return true
}

export function validateCreateCoupon(req: Request, res: Response, next: NextFunction): void {
  if (!validateBody(req, res, false)) return
  next()
}

export function validateUpdateCoupon(req: Request, res: Response, next: NextFunction): void {
  if (!validateBody(req, res, true)) return
  next()
}

export function validatePreviewCoupon(req: Request, res: Response, next: NextFunction): void {
  const { code, items } = req.body ?? {}

  if (!checkId(res, code, 'Vui lòng nhập mã giảm giá')) return

  // Chặn ĐỘ DÀI ngay tại cổng. Không có trần thì một `code` vài megabyte vẫn đi
  // trọn normalizeCode rồi thành một lượt truy vấn Prisma — lỗi của client mà bắt
  // DB gánh. Dùng đúng trần 32 của CODE_RE ở validateBody để hai cổng cùng một luật.
  if (code.trim().length > MAX_CODE_LENGTH) {
    sendError(res, 400, `Mã giảm giá không được dài quá ${MAX_CODE_LENGTH} ký tự`)
    return
  }

  // Cùng bộ luật items với validateCreateOrder: preview và đặt hàng phải từ chối
  // đúng những payload như nhau, nếu không preview báo giảm được rồi đặt hàng ăn 400.
  //
  // Quan trọng hơn: thiếu `quantity` cho ra salePrice * undefined = NaN, mà
  // `NaN < minOrderValue` là FALSE nên nhánh đơn tối thiểu không bao giờ chạy —
  // cổng sàn đơn biến mất, đúng thứ mà "server tự tính subtotal" sinh ra để chặn.
  // Forged subtotal còn so sánh được, NaN thì làm phép so sánh thành vô nghĩa.
  if (items !== undefined) {
    if (!Array.isArray(items) || items.length === 0) {
      sendError(res, 400, 'Danh sách sản phẩm không hợp lệ')
      return
    }
    for (const item of items) {
      // `item?.` chứ không `item.`: phần tử null trong mảng sẽ ném TypeError thành
      // 500, mà preview là endpoint KIỂM TRA — payload rác phải ra 400.
      if (!checkId(res, item?.variantId, 'variantId không hợp lệ')) return
      if (!checkQuantity(res, Number(item?.quantity))) return
    }
  }

  next()
}
