export interface PutProgressReq {
  userId: string
  bookId: string
  percent: number
  updated_at: string
}
export interface PutProgressRes {
  ok: boolean
}

export async function putProgress(_req: PutProgressReq): Promise<PutProgressRes> {
  const { saveProgress } = await import('../services/progressDao')
  await saveProgress(_req.userId, _req.bookId, _req.percent)
  return { ok: true }
}
