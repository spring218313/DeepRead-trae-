export function lww<T extends { updated_at: string }>(local: T, remote: T): T {
  return new Date(remote.updated_at).getTime() > new Date(local.updated_at).getTime() ? remote : local
}

export function mergeList<T extends { id: string; updated_at: string }>(base: T[], incoming: T[]): T[] {
  const map = new Map<string, T>()
  base.forEach(x => map.set(x.id, x))
  incoming.forEach(x => {
    const prev = map.get(x.id)
    if (!prev) map.set(x.id, x)
    else map.set(x.id, lww(prev, x))
  })
  return Array.from(map.values())
}
