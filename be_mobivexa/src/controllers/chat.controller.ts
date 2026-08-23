import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import * as chatService from '../services/chat.service'

export const create = asyncHandler(async (req: Request, res: Response) => {
  const result = await chatService.createSession(req.user?.userId)
  sendSuccess(res, result, 201)
})

export const send = asyncHandler(async (req: Request, res: Response) => {
  const result = await chatService.sendMessage(req.body, req.user?.userId)
  sendSuccess(res, result)
})

export const messages = asyncHandler(async (req: Request, res: Response) => {
  const result = await chatService.getMessages(req.params.id as string, req.user?.userId)
  sendSuccess(res, result)
})
