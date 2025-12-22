export interface ExportBackupReq {
  userId: string
}
export interface ExportBackupRes {
  data: Record<string, unknown>
}

export interface ImportBackupReq {
  userId: string
  data: Record<string, unknown>
  strategy?: 'lww'
}
export interface ImportBackupRes {
  ok: boolean
}

export async function exportBackup(_req: ExportBackupReq): Promise<ExportBackupRes> {
  const { exportUserData } = await import('../services/backupDao')
  const data = await exportUserData(_req.userId)
  return { data }
}

export async function importBackup(_req: ImportBackupReq): Promise<ImportBackupRes> {
  const { importUserData } = await import('../services/backupDao')
  await importUserData(_req.userId, _req.data)
  return { ok: true }
}
