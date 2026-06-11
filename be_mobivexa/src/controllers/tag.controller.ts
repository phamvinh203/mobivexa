import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import { getTags, createTag, deleteTag } from '../services/tag.service'

export const listTags = asyncHandler(async (_req: Request, res: Response) => {
  const tags = await getTags()
  sendSuccess(res, { tags })
})

export const createTagAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { name, slug } = req.body
  const tag = await createTag(name, slug)
  sendSuccess(res, { message: 'Tạo tag thành công', tag }, 201)
})

export const deleteTagAdmin = asyncHandler(async (req: Request, res: Response) => {
  await deleteTag(req.params.id as string)
  sendSuccess(res, { message: 'Xóa tag thành công' })
})
