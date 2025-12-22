export function logInfo(message: string, meta?: Record<string, unknown>) {
  const m = meta ? JSON.stringify(meta) : ''
  console.log(`[INFO] ${message}${m ? ' ' + m : ''}`)
}

export function logError(message: string, meta?: Record<string, unknown>) {
  const m = meta ? JSON.stringify(meta) : ''
  console.error(`[ERROR] ${message}${m ? ' ' + m : ''}`)
}

export function logRequest(method: string, path: string, userId?: string) {
  console.log(`[REQ] ${method} ${path} ${userId ?? ''}`)
}
