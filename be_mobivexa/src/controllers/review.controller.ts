import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import * as service from '../services/review.service'

// ─── Public ───────────────────────────────────────────────────────────────────

export const getSummary = asyncHandler(async (req, res) => {
  const data = await service.getReviewSummary(req.params.slug as string)
  sendSuccess(res, data)
})

export const list = asyncHandler(async (req, res) => {
  const data = await service.listReviews(req.params.slug as string, req.query as any)
  sendSuccess(res, data)
})

// ─── User ─────────────────────────────────────────────────────────────────────

export const getPending = asyncHandler(async (req, res) => {
  const data = await service.getPendingReviews(req.user!.userId)
  sendSuccess(res, data)
})

export const create = asyncHandler(async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined
  const data = await service.createReview(
    req.user!.userId,
    req.params.orderItemId as string,
    req.body,
    files
  )
  sendSuccess(res, data, 201)
})

export const getMyReviews = asyncHandler(async (req, res) => {
  const data = await service.getMyReviews(req.user!.userId, req.query as any)
  sendSuccess(res, data)
})

export const update = asyncHandler(async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined
  const data = await service.updateReview(req.user!.userId, req.params.id as string, req.body, files)
  sendSuccess(res, data)
})

export const deleteOwn = asyncHandler(async (req, res) => {
  await service.deleteMyReview(req.user!.userId, req.params.id as string)
  sendSuccess(res, null, 204)
})

export const helpful = asyncHandler(async (req, res) => {
  const data = await service.toggleHelpful(req.user!.userId, req.params.id as string)
  sendSuccess(res, data)
})

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminList = asyncHandler(async (req, res) => {
  const data = await service.listReviewsAdmin(req.query as any)
  sendSuccess(res, data)
})

export const adminReply = asyncHandler(async (req, res) => {
  const data = await service.replyReview(req.params.id as string, req.body.content as string)
  sendSuccess(res, data)
})

export const adminDelete = asyncHandler(async (req, res) => {
  await service.deleteReview(req.params.id as string)
  sendSuccess(res, null, 204)
})
