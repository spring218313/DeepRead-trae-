export interface QueryResult<T> {
  rows: T[]
}

export interface DB {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>
}

export function createDB(): DB {
  return {
    async query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
      const normalized = sql.trim().replace(/\s+/g, ' ')
      const upper = normalized.toUpperCase()

      if (upper.startsWith('INSERT INTO ')) {
        handleInsert(normalized, params)
        return { rows: [] as T[] }
      }
      if (upper.startsWith('UPDATE ')) {
        handleUpdate(normalized, params)
        return { rows: [] as T[] }
      }
      if (upper.startsWith('DELETE FROM ')) {
        handleDelete(normalized, params)
        return { rows: [] as T[] }
      }
      if (upper.startsWith('SELECT ')) {
        const rows = handleSelect(normalized, params)
        return { rows: rows as T[] }
      }
      return { rows: [] as T[] }
    }
  }
}

export function now(): string {
  return new Date().toISOString()
}

type Row = Record<string, any>

const tableKey = (t: string) => `dr_backend_table_${t}`

const memoryTables = new Map<string, Row[]>()

function readTable(table: string): Row[] {
  if (!('localStorage' in globalThis)) {
    return memoryTables.get(table) ?? []
  }
  try {
    const raw = localStorage.getItem(tableKey(table))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeTable(table: string, rows: Row[]): void {
  if (!('localStorage' in globalThis)) {
    memoryTables.set(table, rows)
    return
  }
  localStorage.setItem(tableKey(table), JSON.stringify(rows))
}

function extractBetween(sql: string, left: string, right: string): string | null {
  const a = sql.indexOf(left)
  if (a < 0) return null
  const b = sql.indexOf(right, a + left.length)
  if (b < 0) return null
  return sql.slice(a + left.length, b)
}

function parseTableNameFromInsert(sql: string): string | null {
  const m = /^INSERT INTO\s+([a-zA-Z0-9_]+)\s*\(/i.exec(sql)
  return m?.[1] ?? null
}

function parseTableNameFromUpdate(sql: string): string | null {
  const m = /^UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+/i.exec(sql)
  return m?.[1] ?? null
}

function parseTableNameFromDelete(sql: string): string | null {
  const m = /^DELETE FROM\s+([a-zA-Z0-9_]+)\s+/i.exec(sql)
  return m?.[1] ?? null
}

function parseTableNameFromSelect(sql: string): string | null {
  const m = /\sFROM\s+([a-zA-Z0-9_]+)\s+/i.exec(sql + ' ')
  return m?.[1] ?? null
}

function handleInsert(sql: string, params: unknown[]): void {
  const table = parseTableNameFromInsert(sql)
  if (!table) return

  const colsRaw = extractBetween(sql, `${table}(`, ') VALUES')
  if (!colsRaw) return
  const cols = colsRaw.split(',').map(s => s.trim()).filter(Boolean)
  const row: Row = {}
  cols.forEach((c, i) => { row[c] = params[i] })

  if (table === 'progress') {
    const userId = String(row['user_id'] ?? '')
    const bookId = String(row['book_id'] ?? '')
    row['id'] = `${userId}:${bookId}`
  }

  const rows = readTable(table)
  const id = row['id']
  if (typeof id === 'string' && id) {
    const idx = rows.findIndex(r => r.id === id)
    if (idx >= 0) {
      if (/ON CONFLICT\s+DO NOTHING/i.test(sql)) return
      rows[idx] = { ...rows[idx], ...row }
      writeTable(table, rows)
      return
    }
    rows.push(row)
    writeTable(table, rows)
    return
  }

  rows.push(row)
  writeTable(table, rows)
}

function handleUpdate(sql: string, params: unknown[]): void {
  const table = parseTableNameFromUpdate(sql)
  if (!table) return
  const setRaw = extractBetween(sql, ' SET ', ' WHERE ')
  const whereRaw = sql.split(/\sWHERE\s/i)[1] ?? ''
  if (!setRaw) return

  const assignments = setRaw.split(',').map(s => s.trim()).filter(Boolean)
  const patch: Row = {}
  for (const a of assignments) {
    const [col, expr] = a.split('=').map(s => s.trim())
    if (!col || !expr) continue
    const m = /\$(\d+)/.exec(expr)
    if (!m) continue
    const idx = Number(m[1]) - 1
    const val = params[idx]
    if (/^COALESCE\(/i.test(expr)) {
      if (val !== null && val !== undefined) patch[col] = val
    } else {
      patch[col] = val
    }
  }

  const rows = readTable(table)
  const filters = parseWhereFilters(whereRaw, params)
  const next = rows.map(r => matchesFilters(r, filters) ? { ...r, ...patch } : r)
  writeTable(table, next)
}

function handleDelete(sql: string, params: unknown[]): void {
  const table = parseTableNameFromDelete(sql)
  if (!table) return
  const whereRaw = sql.split(/\sWHERE\s/i)[1] ?? ''
  const filters = parseWhereFilters(whereRaw, params)
  const rows = readTable(table)
  const next = rows.filter(r => !matchesFilters(r, filters))
  writeTable(table, next)
}

type Filter = { column: string; value: unknown }

function parseWhereFilters(whereRaw: string, params: unknown[]): Filter[] {
  const parts = whereRaw.split(/\s+AND\s+/i).map(s => s.trim()).filter(Boolean)
  const out: Filter[] = []
  for (const p of parts) {
    const m = /^([a-zA-Z0-9_]+)\s*=\s*\$(\d+)/.exec(p)
    if (!m) continue
    const column = m[1]
    const idx = Number(m[2]) - 1
    out.push({ column, value: params[idx] })
  }
  return out
}

function matchesFilters(row: Row, filters: Filter[]): boolean {
  for (const f of filters) {
    if (row[f.column] !== f.value) return false
  }
  return true
}

function handleSelect(sql: string, params: unknown[]): Row[] {
  const table = parseTableNameFromSelect(sql)
  if (!table) return []
  const rows = readTable(table)

  const wherePart = sql.split(/\sWHERE\s/i)[1]?.split(/\sORDER BY\s/i)[0]?.split(/\sLIMIT\s/i)[0] ?? ''
  const orderPart = sql.split(/\sORDER BY\s/i)[1]?.split(/\sLIMIT\s/i)[0] ?? ''
  const limitPart = sql.split(/\sLIMIT\s/i)[1] ?? ''

  let filtered = rows
  if (table === 'book_content' && /\bILIKE\b/i.test(wherePart)) {
    const bookId = String(params[0] ?? '')
    const q = String(params[1] ?? '')
    const qLower = q.toLowerCase()
    filtered = rows.filter(r =>
      String(r.book_id ?? '') === bookId &&
      String(r.text ?? '').toLowerCase().includes(qLower)
    )
  } else if (wherePart) {
    const filters = parseWhereFilters(wherePart, params)
    filtered = rows.filter(r => matchesFilters(r, filters))
  }

  if (orderPart) {
    const m = /^([a-zA-Z0-9_]+)\s+(ASC|DESC)/i.exec(orderPart.trim())
    if (m) {
      const col = m[1]
      const dir = m[2].toUpperCase()
      filtered = [...filtered].sort((a, b) => {
        const av = a[col]
        const bv = b[col]
        if (av === bv) return 0
        if (av === undefined || av === null) return 1
        if (bv === undefined || bv === null) return -1
        if (typeof av === 'number' && typeof bv === 'number') return dir === 'ASC' ? av - bv : bv - av
        const as = String(av)
        const bs = String(bv)
        return dir === 'ASC' ? as.localeCompare(bs) : bs.localeCompare(as)
      })
    }
  }

  const limit = Number.parseInt(limitPart.trim(), 10)
  if (!Number.isNaN(limit) && limit > 0) {
    filtered = filtered.slice(0, limit)
  }

  const selectRaw = sql.slice(0, sql.toUpperCase().indexOf(' FROM ')).replace(/^SELECT\s+/i, '').trim()
  if (selectRaw === '*' || selectRaw === '') return filtered
  const cols = selectRaw.split(',').map(s => s.trim()).filter(Boolean)
  return filtered.map(r => {
    const out: Row = {}
    cols.forEach(c => { out[c] = r[c] })
    return out
  })
}
