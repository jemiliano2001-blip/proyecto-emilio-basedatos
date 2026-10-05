'use client'

import { useState } from 'react'
import { type SolicitudPendienteRecord, type RecepcionPendienteRecord, type InstalacionPendienteRecord, putSolicitudPendiente, putRecepcionPendiente, putInstalacionPendiente } from '@/lib/offline/db'
import { validateInstalacionInput } from '@/lib/validations/instalacion'
import { validateSolicitudInput } from '@/lib/validations/solicitud'
import { validateRecepcionInput } from '@/lib/validations/recepcion'

// Mismas reglas que sugerirEstado() de RecepcionForm. El registro offline no guarda lo
// pendiente de la OC, así que "completo" solo se conserva si la captura original lo era y la
// cantidad buena no bajó; ante la duda queda "parcial" y Compras lo confirma al revisar.
function recalcularEstadoItem(
  original: { cantidad_recibida: number; cantidad_danada: number; estado: string },
  buena: number,
  danada: number
): string {
  if (danada > 0 && buena === 0) return 'danado'
  if (buena === 0 && danada === 0) return 'faltante'
  if (danada > 0) return 'parcial'
  if (original.estado === 'completo' && buena >= Number(original.cantidad_recibida)) return 'completo'
  return 'parcial'
}

export function OfflineRecordEditor({ record, onSaved, onCancel }: {
  record: SolicitudPendienteRecord | RecepcionPendienteRecord | InstalacionPendienteRecord; onSaved: () => Promise<void>; onCancel: () => void
}) {
  return 'material_id' in record
    ? <OfflineInstalacionEditor record={record} onSaved={onSaved} onCancel={onCancel} />
    : <OfflineChecklistEditor record={record} onSaved={onSaved} onCancel={onCancel} />
}

function OfflineChecklistEditor({ record, onSaved, onCancel }: {
  record: SolicitudPendienteRecord | RecepcionPendienteRecord; onSaved: () => Promise<void>; onCancel: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const isSolicitud = 'obra_id' in record
  async function save(data: FormData) {
    setBusy(true); setError(null)
    try {
      const items = record.items.map((item, index) => {
        if ('cantidad_solicitada' in item) return { ...item,
          cantidad_solicitada: item.material_id ? data.get(`cantidad-${index}`) : null,
          descripcion: data.get(`descripcion-${index}`) ?? item.descripcion,
          nota: data.get(`nota-${index}`),
        }
        const buena = Number(data.get(`cantidad-${index}`))
        const danada = Number(data.get(`danada-${index}`))
        return { ...item, cantidad_recibida: data.get(`cantidad-${index}`),
          cantidad_danada: data.get(`danada-${index}`), observacion: data.get(`nota-${index}`),
          estado: Number.isFinite(buena) && Number.isFinite(danada)
            ? recalcularEstadoItem(item, buena, danada)
            : item.estado }
      })
      const raw = { ...record, nota: data.get('nota'), items }
      if (isSolicitud) {
        const parsed = validateSolicitudInput(raw)
        if (!parsed.ok) { setError(parsed.error); return }
        await putSolicitudPendiente({ ...record, ...parsed.data, status: 'guardado_local', error: null, updated_at: new Date().toISOString() })
      } else {
        const parsed = validateRecepcionInput(raw)
        if (!parsed.ok) { setError(parsed.error); return }
        await putRecepcionPendiente({ ...record, ...parsed.data, status: 'guardado_local', error: null, updated_at: new Date().toISOString() })
      }
      await onSaved()
    } catch { setError('No se pudieron guardar los cambios. La captura original permanece en el teléfono.') }
    finally { setBusy(false) }
  }
  return <form action={save} className="card my-4 space-y-4" aria-label="Corregir captura">
    <h3 className="font-bold">Revisar captura</h3>
    <p className="text-sm">Corrige cantidades o notas. Si el proyecto u orden ya no admite capturas, conserva el registro hasta resolverlo con Compras.</p>
    {record.items.map((item, index) => <fieldset key={index} className="space-y-4 border-b border-rule pb-4">
      <legend className="font-semibold">Renglón {index + 1}</legend>
      {('cantidad_solicitada' in item ? item.material_id : true) && <label className="block">Cantidad<input className="input-base" name={`cantidad-${index}`} type="number" step="0.01" min={isSolicitud ? '0.01' : '0'} required defaultValue={'cantidad_solicitada' in item ? item.cantidad_solicitada ?? '' : item.cantidad_recibida} /></label>}
      {'cantidad_danada' in item && <label className="block">Cantidad dañada<input className="input-base" name={`danada-${index}`} type="number" step="0.01" min="0" required defaultValue={item.cantidad_danada} /></label>}
      {'descripcion' in item && !item.material_id && <label className="block">Descripción<input className="input-base" name={`descripcion-${index}`} defaultValue={item.descripcion ?? ''} required /></label>}
      <label className="block">Nota<input className="input-base" name={`nota-${index}`} defaultValue={'nota' in item ? item.nota ?? '' : item.observacion ?? ''} /></label>
    </fieldset>)}
    <label className="block">Nota general<textarea className="input-base" name="nota" defaultValue={record.nota ?? ''} /></label>
    {error && <p role="alert" className="text-danger">{error}</p>}
    <div className="flex gap-4"><button className="btn-primary" disabled={busy} aria-busy={busy}>Guardar corrección</button><button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>Volver</button></div>
  </form>
}

function OfflineInstalacionEditor({record,onSaved,onCancel}: {
  record: InstalacionPendienteRecord; onSaved: () => Promise<void>; onCancel: () => void
}) {
  const [error,setError] = useState<string | null>(null)
  const [busy,setBusy] = useState(false)
  return <form className="card my-4 space-y-3" action={async data => {
    setBusy(true); setError(null)
    try {
      const parsed = validateInstalacionInput({...record,cantidad:data.get('cantidad'),nota:data.get('nota')})
      if (!parsed.ok) {setError(parsed.error);return}
      await putInstalacionPendiente({...record,...parsed.data,status:'guardado_local',error:null,updated_at:new Date().toISOString()})
      await onSaved()
    } catch {setError('No se guardó la corrección. La captura permanece en el teléfono.')}
    finally {setBusy(false)}
  }}>
    <h3 className="font-semibold">Revisar instalación</h3>
    <p className="text-sm">Si el proyecto ya no admite reportes, resuelve el acceso con Operación antes de reintentar.</p>
    <label className="block">Cantidad<input className="input-base" name="cantidad" type="number" min="0.01" step="0.01" required defaultValue={record.cantidad} /></label>
    <label className="block">Nota<textarea className="input-base" name="nota" maxLength={2000} defaultValue={record.nota ?? ''} /></label>
    {error && <p role="alert" className="text-danger">{error}</p>}
    <div className="flex gap-3"><button className="btn-primary" disabled={busy}>Guardar corrección</button><button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>Volver</button></div>
  </form>
}
