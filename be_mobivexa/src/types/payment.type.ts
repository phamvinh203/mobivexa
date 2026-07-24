import { SePayTxStatus } from '../generated/prisma/client'

// Payload SePay POST vào webhook khi phát hiện biến động số dư
export interface SePayWebhookPayload {
  id: number
  gateway: string
  transactionDate: string
  accountNumber: string
  subAccount: string | null
  code: string | null
  content: string
  transferType: 'in' | 'out'
  transferAmount: number
  accumulated: number
  referenceCode: string
  description: string
  body: string
}

// Một giao dịch trả về từ SePay UserAPI (GET /userapi/transactions/list).
// Shape KHÁC webhook payload — snake_case và tách amount_in/amount_out.
export interface SePayApiTransaction {
  id: string
  bank_brand_name: string
  account_number: string
  transaction_date: string
  amount_out: string
  amount_in: string
  accumulated: string
  transaction_content: string | null
  reference_number: string | null
  code: string | null
  sub_account: string | null
}

// Dạng chuẩn hoá dùng nội bộ — cả webhook lẫn sync đều quy về shape này
// trước khi đi vào ingestTransaction, để logic khớp đơn chỉ viết một lần.
export interface NormalizedSePayTx {
  sepayId: number
  gateway: string
  accountNumber: string | null
  transferType: 'in' | 'out'
  transferAmount: number
  content: string
  referenceCode: string | null
  transactionDate: Date
  source: 'WEBHOOK' | 'SYNC'
  raw: unknown
}

export interface TransactionListQuery {
  page?: string
  limit?: string
  status?: SePayTxStatus
  orderCode?: string
  from?: string // ISO date
  to?: string
}

export interface MatchTransactionBody {
  orderCode: string
  // Cho phép gán khi số tiền lệch (khách chuyển thừa/thiếu) — admin chịu trách nhiệm
  force?: boolean
}
