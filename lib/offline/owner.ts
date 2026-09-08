export function matchesOfflineOwner(raw: unknown, userId: string | null | undefined): boolean {
  return Boolean(userId) && typeof raw === 'object' && raw !== null &&
    'usuario_id' in raw && raw.usuario_id === userId
}
