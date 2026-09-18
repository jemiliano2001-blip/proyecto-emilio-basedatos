'use client'

import React, { useState, useTransition, useRef } from 'react'
import type { OrdenCompraFactura, OrdenItemParaFactura } from '@/lib/types'
import { eliminarFacturaOrdenAction, subirFacturaOrdenAction } from '@/lib/actions/ordenes'
import { IconClip, IconOjo, IconBasura, IconChevron } from '@/components/icons'
import { QuickLookModal } from '@/components/QuickLookModal'

interface Props {
  ordenId: string
  obraId: string
  totalOrden: number
  moneda: string
  facturas: OrdenCompraFactura[]
  items: OrdenItemParaFactura[]
  puedeGestionar: boolean
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function OrdenCompraFacturasSection({
  ordenId,
  obraId,
  totalOrden,
  moneda,
  facturas,
  items,
  puedeGestionar,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [quickLookIndex, setQuickLookIndex] = useState<number | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [folioFactura, setFolioFactura] = useState('')
  const [montoFactura, setMontoFactura] = useState<string>(
    totalOrden > 0 ? String(totalOrden) : ''
  )
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleItem(id: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setArchivo(e.target.files[0])
      setError(null)
    }
  }

  const handleSubmitUpload = (e: React.FormEvent) => {
    e.preventDefault()
    if (!archivo) {
      setError('Por favor selecciona un archivo PDF o imagen de la factura.')
      return
    }

    setError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.append('orden_id', ordenId)
      formData.append('obra_id', obraId)
      formData.append('archivo', archivo)
      if (folioFactura.trim()) {
        formData.append('folio_factura', folioFactura.trim())
      }
      if (montoFactura.trim()) {
        formData.append('monto_factura', montoFactura.trim())
      }
      for (const id of selectedItemIds) {
        formData.append('item_ids', id)
      }

      const res = await subirFacturaOrdenAction({ error: null }, formData)
      if (res.error) {
        setError(res.error)
      } else {
        setModalOpen(false)
        setArchivo(null)
        setFolioFactura('')
        setMontoFactura(totalOrden > 0 ? String(totalOrden) : '')
        setSelectedItemIds(new Set())
      }
    })
  }

  const handleEliminar = (facturaId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta factura adjunta?')) {
      return
    }
    setDeletingId(facturaId)
    startTransition(async () => {
      const res = await eliminarFacturaOrdenAction(facturaId, ordenId)
      if (res.error) {
        alert(res.error)
      }
      setDeletingId(null)
    })
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Facturas del proveedor
          </h2>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
            {facturas.length}
          </span>
        </div>

        {puedeGestionar && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
          >
            <IconClip className="h-3.5 w-3.5" />
            <span>Adjuntar factura (PDF)</span>
          </button>
        )}
      </div>

      {facturas.length === 0 ? (
        <div className="card text-center py-6 border-dashed border-gray-300">
          <p className="text-gray-400 text-xs font-medium">
            No se ha adjuntado ninguna factura a esta orden de compra.
          </p>
          {puedeGestionar && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-2 text-xs font-semibold text-accent hover:underline"
            >
              Subir comprobante fiscal en PDF o imagen
            </button>
          )}
        </div>
      ) : (
        <div className="card divide-y divide-gray-100 p-0 overflow-hidden">
          {facturas.map((f) => {
            const abiertos = expandedIds.has(f.id)
            const mats = f.items ?? []
            const titulo =
              f.folio_factura?.trim() ||
              f.archivo_nombre ||
              'Factura'
            return (
              <div key={f.id} className="bg-white">
                <div className="flex items-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => toggleExpand(f.id)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 min-h-[52px]"
                    aria-expanded={abiertos}
                  >
                    <IconChevron
                      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                        abiertos ? 'rotate-90' : ''
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <a
                        href={f.archivo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-sm text-accent hover:underline break-all"
                      >
                        {titulo}
                      </a>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {mats.length === 0
                          ? 'Sin materiales ligados'
                          : `${mats.length} material${mats.length === 1 ? '' : 'es'}`}
                        {f.monto_factura != null
                          ? ` · $${Number(f.monto_factura).toLocaleString('es-MX', {
                              minimumFractionDigits: 2,
                            })} ${moneda}`
                          : ''}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 pr-2 shrink-0">
                    {f.tipo_archivo === 'xml' ? (
                      <a
                        href={f.archivo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-xs font-semibold text-accent hover:underline"
                        title="Abrir XML"
                      >
                        XML
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setQuickLookIndex(facturas.findIndex((x) => x.id === f.id))}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-gray-500 hover:text-ink rounded-lg hover:bg-gray-100"
                        title="Vista previa"
                      >
                        <IconOjo className="h-4 w-4" />
                      </button>
                    )}
                    {puedeGestionar && (
                      <button
                        type="button"
                        onClick={() => handleEliminar(f.id)}
                        disabled={deletingId === f.id}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-gray-400 hover:text-danger rounded-lg hover:bg-red-50 disabled:opacity-50"
                        title="Eliminar factura"
                      >
                        <IconBasura className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                {abiertos && (
                  <div className="px-4 pb-3 pl-11 space-y-1.5 bg-slate-50/60">
                    {mats.length === 0 ? (
                      <p className="text-xs text-gray-500 py-1">
                        Esta factura no tiene materiales asignados.
                      </p>
                    ) : (
                      mats.map((m) => (
                        <div
                          key={m.orden_item_id}
                          className="flex justify-between gap-2 text-sm py-1 border-b border-gray-100 last:border-0"
                        >
                          <span className="text-ink">{m.nombre}</span>
                          <span className="text-gray-500 shrink-0 tabular-nums">
                            {m.cantidad} {m.unidad}
                          </span>
                        </div>
                      ))
                    )}
                    <p className="text-[11px] text-gray-400 pt-1">
                      {formatBytes(f.tamano_bytes)} ·{' '}
                      {new Date(f.creado_en).toLocaleDateString('es-MX')}
                      {f.subido_por_nombre ? ` · ${f.subido_por_nombre}` : ''}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-gray-100 max-h-[90dvh] overflow-y-auto">
            <h3 className="text-lg font-bold text-ink mb-1">
              Adjuntar factura del proveedor
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Sube el PDF y marca qué materiales cubre esta factura.
            </p>

            {error && (
              <div
                className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200"
                role="alert"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmitUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Archivo de la Factura (PDF, Imagen o XML) *
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,text/xml,application/xml"
                  className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-ink file:text-white hover:file:bg-ink/90 border border-gray-300 rounded-lg p-1 cursor-pointer"
                />
                {archivo && (
                  <p className="text-[11px] text-accent mt-1 font-medium">
                    Archivo seleccionado: {archivo.name} ({formatBytes(archivo.size)})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Folio o Número de Factura (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. F-14329"
                  value={folioFactura}
                  onChange={(e) => setFolioFactura(e.target.value)}
                  className="input-base text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Monto Facturado ({moneda})
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ej. 1496.88"
                  value={montoFactura}
                  onChange={(e) => setMontoFactura(e.target.value)}
                  className="input-base text-sm"
                />
              </div>

              {items.length > 0 && (
                <fieldset>
                  <legend className="text-xs font-semibold text-gray-700 mb-2">
                    Materiales de esta factura
                  </legend>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                    {items.map((it) => {
                      const checked = selectedItemIds.has(it.id)
                      return (
                        <label
                          key={it.id}
                          className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleItem(it.id)}
                            className="mt-1"
                          />
                          <span className="min-w-0">
                            <span className="font-medium text-ink block">{it.nombre}</span>
                            <span className="text-xs text-gray-500">
                              {it.cantidad} {it.unidad}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Opcional: deja vacío si aún no repartes materiales.
                  </p>
                </fieldset>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isPending}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || !archivo}
                  aria-busy={isPending}
                  className="btn-primary text-xs px-4 py-2"
                >
                  {isPending ? 'Subiendo factura…' : 'Subir factura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <QuickLookModal
        open={quickLookIndex !== null}
        initialIndex={quickLookIndex ?? 0}
        onClose={() => setQuickLookIndex(null)}
        items={facturas.map((f) => ({
          url: f.archivo_url,
          nombre: f.folio_factura ? `Factura ${f.folio_factura}` : (f.archivo_nombre || 'Documento'),
          tipo: (f.archivo_nombre || '').toLowerCase().endsWith('.pdf') ? 'pdf' : 'imagen',
          tamano: formatBytes(f.tamano_bytes),
          subidoPor: f.subido_por_nombre,
          fecha: new Date(f.creado_en).toLocaleDateString('es-MX'),
        }))}
      />
    </section>
  )
}
