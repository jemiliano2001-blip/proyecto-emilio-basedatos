'use client'

import { useMemo, useState } from 'react'
import { useFormState } from 'react-dom'
import { useOfflineUser } from '@/components/OfflineUserProvider'
import { useRouter } from 'next/navigation'
import type { ActionResult } from '@/lib/actions/recepciones'
import { FormError } from '@/components/FormError'
import { PhotoUploadInput } from '@/components/PhotoUploadInput'
import { SubmitButton } from '@/components/SubmitButton'
import { putRecepcionPendiente } from '@/lib/offline/db'
import { parseQuantity } from '@/lib/money'
import { validateRecepcionInput } from '@/lib/validations/recepcion'
import type { EstadoRecepcionItem, OrdenItemChecklist } from '@/lib/types'

const initialState: ActionResult = { error: null }

interface LineState {
  orden_item_id: string
  cantidad_recibida: string
  cantidad_danada: string
  estado: EstadoRecepcionItem
  observacion: string
  incluido: boolean
}

function sugerirEstado(
  buena: number,
  danada: number,
  pendiente: number
): EstadoRecepcionItem {
  if (danada > 0 && buena === 0) return 'danado'
  if (buena === 0 && danada === 0) return 'faltante'
  if (buena + danada >= pendiente && danada === 0) return 'completo'
  return 'parcial'
}

export function RecepcionForm({
  action,
  ordenId,
  items,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  ordenId: string
  items: OrdenItemChecklist[]
}) {
  const router = useRouter()
  const userId = useOfflineUser()
  const [state, formAction] = useFormState(action, initialState)
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const [offlineMsg, setOfflineMsg] = useState<string | null>(null)
  const recepcionId = useMemo(() => crypto.randomUUID(), [])
  const recibidoEn = useMemo(() => new Date().toISOString(), [])

  const [lines, setLines] = useState<LineState[]>(() =>
    items
      .filter((item) => Number(item.pendiente) > 0)
      .map((item) => ({
        orden_item_id: item.orden_item_id,
        cantidad_recibida: '',
        cantidad_danada: '0',
        estado: 'parcial',
        observacion: '',
        incluido: true,
      }))
  )

  const itemsJson = useMemo(() => {
    const payload = lines
      .filter((line) => line.incluido)
      .map((line) => {
        const buena = parseQuantity(line.cantidad_recibida) ?? 0
        const danada = parseQuantity(line.cantidad_danada) ?? 0
        const meta = items.find((i) => i.orden_item_id === line.orden_item_id)
        const pendiente = meta ? Number(meta.pendiente) : 0
        return {
          orden_item_id: line.orden_item_id,
          cantidad_recibida: buena,
          cantidad_danada: danada,
          estado: line.estado || sugerirEstado(buena, danada, pendiente),
          observacion: line.observacion.trim() === '' ? null : line.observacion.trim(),
        }
      })
    return JSON.stringify(payload)
  }, [lines, items])

  function actualizar(ordenItemId: string, cambios: Partial<LineState>) {
    setLines((prev) =>
      prev.map((line) =>
        line.orden_item_id === ordenItemId ? { ...line, ...cambios } : line
      )
    )
  }

  async function guardarOffline(formData: FormData) {
    if (!userId) { setOfflineError("Inicia sesión para guardar en este teléfono."); return }
    setOfflineError(null)
    setOfflineMsg(null)
    try {
      let itemsRaw: unknown = []
      const itemsJson = formData.get('items_json')
      if (typeof itemsJson === 'string' && itemsJson.trim() !== '') {
        try {
          itemsRaw = JSON.parse(itemsJson)
        } catch {
          setOfflineError('No se pudieron leer los renglones del checklist.')
          return
        }
      }

      const referencia = formData.get('referencia_entrega')
      const nota = formData.get('nota')
      const parsed = validateRecepcionInput({
        id: formData.get('id'),
        orden_id: ordenId,
        referencia_entrega: referencia,
        nota,
        recibido_en: formData.get('recibido_en'),
        items: itemsRaw,
      })

      if (!parsed.ok) {
        setOfflineError(parsed.error)
        return
      }

      const now = new Date().toISOString()

      await putRecepcionPendiente({
        usuario_id: userId,
        id: parsed.data.id,
        orden_id: parsed.data.orden_id,
        referencia_entrega: parsed.data.referencia_entrega,
        nota: parsed.data.nota,
        recibido_en: parsed.data.recibido_en,
        items: parsed.data.items,
        status: 'guardado_local',
        error: null,
        created_at: now,
        updated_at: now,
      })

      setOfflineMsg('Guardado en este teléfono. Se enviará al recuperar conexión.')
      router.push('/recepciones')
    } catch {
      setOfflineError('No se pudo guardar en este teléfono.')
    }
  }

  function handleSubmit(formData: FormData) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      void guardarOffline(formData)
      return
    }
    formAction(formData)
  }

  if (lines.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-gray-600">
          Esta orden ya no tiene cantidades pendientes por recibir.
        </p>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="id" value={recepcionId} />
      <input type="hidden" name="orden_id" value={ordenId} />
      <input type="hidden" name="recibido_en" value={recibidoEn} />
      <input type="hidden" name="items_json" value={itemsJson} />

      <FormError message={state.error ?? offlineError} />
      {offlineMsg && (
        <p className="rounded-lg bg-teal-50 text-teal-800 text-sm px-3 py-2">{offlineMsg}</p>
      )}

      <div>
        <label
          htmlFor="referencia_entrega"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Referencia de entrega (opcional)
        </label>
        <input
          id="referencia_entrega"
          name="referencia_entrega"
          className="input-base"
          placeholder="Guía, remisión, nombre del chofer…"
        />
      </div>

      {/* Evidencia fotográfica de entrega en obra */}
      <div className="card space-y-4 border-teal-200/80 bg-teal-50/20">
        <h3 className="text-xs font-bold uppercase tracking-wider text-teal-900">
          Evidencia Fotográfica de Entrega
        </h3>
        <PhotoUploadInput
          id="foto_remision"
          name="foto_remision"
          label="Foto de la remisión física o talón de entrega (opcional)"
          captureCamera={true}
          helpText="Foto legible del documento o papel de entrega firmado por el proveedor o chofer."
        />
        <PhotoUploadInput
          id="foto_evidencia"
          name="foto_evidencia"
          label="Foto de materiales en obra o piezas con daño (opcional)"
          captureCamera={true}
          helpText="Fotografía del material descargado o piezas con empaques rotos/defectos."
        />
      </div>

      <div className="space-y-3">
        {lines.map((line) => {
          const meta = items.find((i) => i.orden_item_id === line.orden_item_id)
          if (!meta) return null
          return (
            <div key={line.orden_item_id} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">
                    {meta.nombre_base}
                    {meta.variante ? (
                      <span className="text-gray-500"> · {meta.variante}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Pedido {Number(meta.cantidad_pedida)} {meta.unidad_medida} · Ya
                    recibido {Number(meta.cantidad_recibida_buena)} · Pendiente{' '}
                    {Number(meta.pendiente)}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm shrink-0">
                  <input
                    type="checkbox"
                    checked={line.incluido}
                    onChange={(e) =>
                      actualizar(line.orden_item_id, { incluido: e.target.checked })
                    }
                    className="h-5 w-5"
                  />
                  Incluir
                </label>
              </div>

              {line.incluido && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Cantidad buena
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input-base"
                        value={line.cantidad_recibida}
                        onChange={(e) =>
                          actualizar(line.orden_item_id, {
                            cantidad_recibida: e.target.value,
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Cantidad dañada
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input-base"
                        value={line.cantidad_danada}
                        onChange={(e) =>
                          actualizar(line.orden_item_id, {
                            cantidad_danada: e.target.value,
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Estado del renglón
                    </label>
                    <select
                      className="input-base"
                      value={line.estado}
                      onChange={(e) =>
                        actualizar(line.orden_item_id, {
                          estado: e.target.value as EstadoRecepcionItem,
                        })
                      }
                    >
                      <option value="completo">Completo</option>
                      <option value="parcial">Parcial</option>
                      <option value="faltante">Faltante</option>
                      <option value="danado">Dañado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Observación
                      {(line.estado === 'faltante' ||
                        line.estado === 'danado' ||
                        (parseQuantity(line.cantidad_danada) ?? 0) > 0) && (
                        <span className="text-red-600"> *</span>
                      )}
                    </label>
                    <textarea
                      className="input-base"
                      rows={2}
                      value={line.observacion}
                      onChange={(e) =>
                        actualizar(line.orden_item_id, { observacion: e.target.value })
                      }
                      placeholder="Obligatoria si hay faltante o daño"
                    />
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <PhotoUploadInput
                      id={`foto_item_${line.orden_item_id}`}
                      name={`foto_item_${line.orden_item_id}`}
                      label="Foto del material / daño (opcional)"
                      captureCamera={true}
                      helpText="Evidencia fotográfica directa de este material recibido o pieza dañada."
                    />
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div>
        <label htmlFor="nota" className="block text-sm font-medium text-gray-700 mb-1">
          Nota general (opcional)
        </label>
        <textarea id="nota" name="nota" rows={3} className="input-base" />
      </div>

      <SubmitButton>Enviar checklist a Compras</SubmitButton>
      <p className="text-xs text-gray-500 text-center">
        Sin señal: se guarda en este teléfono y se envía al recuperar conexión.
      </p>
    </form>
  )
}
