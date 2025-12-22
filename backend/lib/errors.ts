export class AppError extends Error {
  code: string
  status: number
  constructor(message: string, code = 'UNKNOWN', status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}
