const DB_NAME = 'proyecto-emilio-offline'
const DB_VERSION = 1

export type OfflineQueueStatus =
  | 'guardado_local'
  | 'pendiente'
  | 'enviado'
  | 'conflicto'
  | 'necesita_revision'

export interface RecepcionPendienteRecord {
  usuario_id: string
  id: string
  orden_id: string
  referencia_entrega: string | null
  nota: string | null
  recibido_en: string
  items: {
    orden_item_id: string
    cantidad_recibida: number
    cantidad_danada: number
    estado: string
    observacion: string | null
  }[]
  status: OfflineQueueStatus
  error: string | null
  created_at: string
  updated_at: string
}

export interface SolicitudPendienteRecord {
  usuario_id: string
  id: string
  obra_id: string
  nota: string | null
  items: {
    tipo_linea?: string
    material_id: string | null
    cantidad_solicitada: number | null
    descripcion?: string | null
    monto_mxn?: number | null
    nota: string | null
  }[]
  status: OfflineQueueStatus
  error: string | null
  created_at: string
  updated_at: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible en este dispositivo.'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('recepciones_pendientes')) {
        db.createObjectStore('recepciones_pendientes', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('solicitudes_pendientes')) {
        db.createObjectStore('solicitudes_pendientes', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('catalogo_cache')) {
        db.createObjectStore('catalogo_cache', { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('No se pudo abrir IndexedDB.'))
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    let request: IDBRequest<T> | undefined

    try {
      const result = fn(store)
      if (result) request = result
    } catch (error) {
      reject(error)
      return
    }

    tx.oncomplete = () => {
      resolve(request ? request.result : undefined)
      db.close()
    }
    tx.onerror = () => {
      reject(tx.error ?? new Error('Error en IndexedDB.'))
      db.close()
    }
  })
}

export async function putRecepcionPendiente(
  record: RecepcionPendienteRecord
): Promise<void> {
  await withStore('recepciones_pendientes', 'readwrite', (store) => {
    store.put(record)
  })
}

export async function listRecepcionesPendientes(userId: string): Promise<RecepcionPendienteRecord[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recepciones_pendientes', 'readonly')
    const store = tx.objectStore('recepciones_pendientes')
    const request = store.getAll()
    request.onsuccess = () => {
      resolve(((request.result as RecepcionPendienteRecord[]) ?? []).filter(r => r.usuario_id === userId))
      db.close()
    }
    request.onerror = () => {
      reject(request.error ?? new Error('No se pudieron leer recepciones locales.'))
      db.close()
    }
  })
}

export async function updateRecepcionPendienteStatus(
  id: string,
  status: OfflineQueueStatus,
  error: string | null = null
): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('recepciones_pendientes', 'readwrite')
    const store = tx.objectStore('recepciones_pendientes')
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const current = getReq.result as RecepcionPendienteRecord | undefined
      if (!current) {
        resolve()
        return
      }
      store.put({
        ...current,
        status,
        error,
        updated_at: new Date().toISOString(),
      })
    }
    tx.oncomplete = () => {
      resolve()
      db.close()
    }
    tx.onerror = () => {
      reject(tx.error ?? new Error('No se pudo actualizar la recepción local.'))
      db.close()
    }
  })
}

export async function deleteRecepcionPendiente(id: string): Promise<void> {
  await withStore('recepciones_pendientes', 'readwrite', (store) => {
    store.delete(id)
  })
}

export async function putSolicitudPendiente(
  record: SolicitudPendienteRecord
): Promise<void> {
  await withStore('solicitudes_pendientes', 'readwrite', (store) => {
    store.put(record)
  })
}

export async function listSolicitudesPendientes(userId: string): Promise<SolicitudPendienteRecord[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('solicitudes_pendientes', 'readonly')
    const store = tx.objectStore('solicitudes_pendientes')
    const request = store.getAll()
    request.onsuccess = () => {
      resolve(((request.result as SolicitudPendienteRecord[]) ?? []).filter(r => r.usuario_id === userId))
      db.close()
    }
    request.onerror = () => {
      reject(request.error ?? new Error('No se pudieron leer solicitudes locales.'))
      db.close()
    }
  })
}

export async function updateSolicitudPendienteStatus(
  id: string,
  status: OfflineQueueStatus,
  error: string | null = null
): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('solicitudes_pendientes', 'readwrite')
    const store = tx.objectStore('solicitudes_pendientes')
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const current = getReq.result as SolicitudPendienteRecord | undefined
      if (!current) {
        resolve()
        return
      }
      store.put({
        ...current,
        status,
        error,
        updated_at: new Date().toISOString(),
      })
    }
    tx.oncomplete = () => {
      resolve()
      db.close()
    }
    tx.onerror = () => {
      reject(tx.error ?? new Error('No se pudo actualizar la solicitud local.'))
      db.close()
    }
  })
}

export async function deleteSolicitudPendiente(id: string): Promise<void> {
  await withStore('solicitudes_pendientes', 'readwrite', (store) => {
    store.delete(id)
  })
}

export async function putCatalogoCache(key: string, value: unknown): Promise<void> {
  await withStore('catalogo_cache', 'readwrite', (store) => {
    store.put({ key, value, updated_at: new Date().toISOString() })
  })
}

export async function getCatalogoCache<T>(key: string): Promise<T | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('catalogo_cache', 'readonly')
    const store = tx.objectStore('catalogo_cache')
    const request = store.get(key)
    request.onsuccess = () => {
      const row = request.result as { value: T } | undefined
      resolve(row ? row.value : null)
      db.close()
    }
    request.onerror = () => {
      reject(request.error ?? new Error('No se pudo leer el caché local.'))
      db.close()
    }
  })
}
