import { SupportSender, SupportTicketStatus } from '../generated/prisma/client'

// ─── Hằng số nghiệp vụ ────────────────────────────────────────────────────────

export const MAX_SUPPORT_MESSAGE_LENGTH = 2000
export const MAX_SUPPORT_NAME_LENGTH = 60

// Header guest gửi kèm khi GET/POST vào phiên của mình — giá trị là accessCode
// trả về MỘT lần lúc tạo ticket. FE lưu localStorage để sống qua reload.
export const SUPPORT_ACCESS_HEADER = 'x-ticket-code'

// ─── Request body ─────────────────────────────────────────────────────────────

export interface CreateSupportTicketBody {
  // Bắt buộc với guest; user đã đăng nhập thì BE lấy fullName trong DB, FE khỏi gửi.
  customerName?: string
  // Tin nhắn đầu của khách — cũng là nội dung vào queue cho staff đọc trước.
  message: string
}

export interface SendSupportMessageBody {
  content: string
}

// ─── DTO trả FE (accessCode/userId bị che, chỉ lộ những gì UI cần) ────────────

export interface SupportMessageDto {
  id: string
  sender: SupportSender
  senderName: string
  content: string
  createdAt: string
}

export interface SupportTicketDto {
  id: string
  status: SupportTicketStatus
  customerName: string
  claimedByName: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  messages: SupportMessageDto[]
}

// Kết quả tạo ticket: accessCode chỉ xuất hiện ĐÚNG MỘT lần ở đây.
export interface CreatedSupportTicketDto extends SupportTicketDto {
  accessCode: string
}

// ─── Admin list ───────────────────────────────────────────────────────────────

export interface AdminSupportTicketListItem {
  id: string
  status: SupportTicketStatus
  customerName: string
  claimedByName: string | null
  createdAt: string
  updatedAt: string
  lastMessage: {
    sender: SupportSender
    senderName: string
    content: string
    createdAt: string
  } | null
}

export interface AdminSupportTicketCounts {
  open: number
  inProgress: number
  closed: number
}

export interface AdminSupportTicketListDto {
  tickets: AdminSupportTicketListItem[]
  counts: AdminSupportTicketCounts
}
