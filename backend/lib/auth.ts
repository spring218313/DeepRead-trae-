export interface AuthContext {
  userId: string
}

export function verifyToken(_authorization?: string): AuthContext {
  return { userId: 'placeholder-user' }
}
