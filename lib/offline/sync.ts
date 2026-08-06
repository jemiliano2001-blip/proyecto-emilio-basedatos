import {
  deleteRecepcionPendiente,
  deleteSolicitudPendiente,
  listRecepcionesPendientes,
  listSolicitudesPendientes,
  updateRecepcionPendienteStatus,
  updateSolicitudPendienteStatus,
  type RecepcionPendienteRecord,
  type SolicitudPendienteRecord,
} from '@/lib/offline/db'

export type SyncSummary = {
  recepcionesOk: number
  solicitudesOk: number
  conflictos: number
  reintentos: number
  noAutenticado: boolean
}

type SyncRecepcionResponse =
  | { status: 'sincronizado'; id: string }
  | { status: 'conflicto'; error: string }
  | { status: 'no_autenticado' }
  | { status: 'reintentar'; error: string }

type SyncSolicitudResponse =
  | { status: 'sincronizado'; id: string }
  | { status: 'conflicto'; error: string }
  | { status: 'no_autenticado' }
  | { status: 'reintentar'; error: string }

async function syncOneRecepcion(
  record: RecepcionPendienteRecord
): Promise<'ok' | 'conflicto' | 'reintentar' | 'no_autenticado'> {
  if (record.status === 'enviado' || record.status === 'conflicto') {
    return record.status === 'conflicto' ? 'conflicto' : 'ok'
  }

  await updateRecepcionPendienteStatus(record.id, 'pendiente')

  const response = await fetch('/api/recepciones/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: record.id,
      orden_id: record.orden_id,
      referencia_entrega: record.referencia_entrega,
      nota: record.nota,
      recibido_en: record.recibido_en,
      items: record.items,
    }),
  })

  let payload: SyncRecepcionResponse
  try {
    payload = (await response.json()) as SyncRecepcionResponse
  } catch {
    await updateRecepcionPendienteStatus(
      record.id,
      'pendiente',
      'No se pudo leer la respuesta del servidor.'
    )
    return 'reintentar'
  }

  if (payload.status === 'sincronizado') {
    await updateRecepcionPendienteStatus(record.id, 'enviado')
    await deleteRecepcionPendiente(record.id)
    return 'ok'
  }
  if (payload.status === 'no_autenticado') {
    await updateRecepcionPendienteStatus(
      record.id,
      'necesita_revision',
      'Sesión expirada. Inicia sesión y reintenta.'
    )
    return 'no_autenticado'
  }
  if (payload.status === 'conflicto') {
    await updateRecepcionPendienteStatus(
      record.id,
      'conflicto',
      payload.error ?? 'Conflicto al sincronizar.'
    )
    return 'conflicto'
  }

  await updateRecepcionPendienteStatus(
    record.id,
    'pendiente',
    payload.error ?? 'Reintentar más tarde.'
  )
  return 'reintentar'
}

async function syncOneSolicitud(
  record: SolicitudPendienteRecord
): Promise<'ok' | 'conflicto' | 'reintentar' | 'no_autenticado'> {
  if (record.status === 'enviado' || record.status === 'conflicto') {
    return record.status === 'conflicto' ? 'conflicto' : 'ok'
  }

  await updateSolicitudPendienteStatus(record.id, 'pendiente')

  const response = await fetch('/api/solicitudes/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: record.id,
      obra_id: record.obra_id,
      nota: record.nota,
      items: record.items,
    }),
  })

  let payload: SyncSolicitudResponse
  try {
    payload = (await response.json()) as SyncSolicitudResponse
  } catch {
    await updateSolicitudPendienteStatus(
      record.id,
      'pendiente',
      'No se pudo leer la respuesta del servidor.'
    )
    return 'reintentar'
  }

  if (payload.status === 'sincronizado') {
    await updateSolicitudPendienteStatus(record.id, 'enviado')
    await deleteSolicitudPendiente(record.id)
    return 'ok'
  }
  if (payload.status === 'no_autenticado') {
    await updateSolicitudPendienteStatus(
      record.id,
      'necesita_revision',
      'Sesión expirada. Inicia sesión y reintenta.'
    )
    return 'no_autenticado'
  }
  if (payload.status === 'conflicto') {
    await updateSolicitudPendienteStatus(
      record.id,
      'conflicto',
      payload.error ?? 'Conflicto al sincronizar.'
    )
    return 'conflicto'
  }

  await updateSolicitudPendienteStatus(
    record.id,
    'pendiente',
    payload.error ?? 'Reintentar más tarde.'
  )
  return 'reintentar'
}

export async function syncOfflineQueues(): Promise<SyncSummary> {
  const summary: SyncSummary = {
    recepcionesOk: 0,
    solicitudesOk: 0,
    conflictos: 0,
    reintentos: 0,
    noAutenticado: false,
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return summary
  }

  const recepciones = await listRecepcionesPendientes()
  for (const record of recepciones) {
    if (record.status === 'conflicto') {
      summary.conflictos += 1
      continue
    }
    const result = await syncOneRecepcion(record)
    if (result === 'ok') summary.recepcionesOk += 1
    if (result === 'conflicto') summary.conflictos += 1
    if (result === 'reintentar') summary.reintentos += 1
    if (result === 'no_autenticado') {
      summary.noAutenticado = true
      break
    }
  }

  const solicitudes = await listSolicitudesPendientes()
  for (const record of solicitudes) {
    if (record.status === 'conflicto') {
      summary.conflictos += 1
      continue
    }
    const result = await syncOneSolicitud(record)
    if (result === 'ok') summary.solicitudesOk += 1
    if (result === 'conflicto') summary.conflictos += 1
    if (result === 'reintentar') summary.reintentos += 1
    if (result === 'no_autenticado') {
      summary.noAutenticado = true
      break
    }
  }

  return summary
}
