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
