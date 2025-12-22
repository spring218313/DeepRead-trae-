export interface QueryResult<T> {
  rows: T[]
}

export interface DB {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>
}

export function createDB(): DB {
  return {
    async query<T>(_sql: string, _params?: unknown[]): Promise<QueryResult<T>> {
      return { rows: [] as T[] }
    }
  }
}

export function now(): string {
  return new Date().toISOString()
}
