'use client'

import React, { useState, useTransition, useRef } from 'react'
import type { OrdenCompraFactura, OrdenItemParaFactura } from '@/lib/types'
import { eliminarFacturaOrdenAction, subirFacturaOrdenAction } from '@/lib/actions/ordenes'
import { IconClip, IconOjo, IconBasura, IconChevron } from '@/components/icons'
import { QuickLookModal } from '@/components/QuickLookModal'
import {
  parsearCfdiXml,
  extraerDatosDesdeNombreArchivo,
  cotejarPartidasConOC,
} from '@/lib/extractor-facturas-nativo'
import { vibrarExito, vibrarTap } from '@/lib/haptics'

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
  const [extraccionMsg, setExtraccionMsg] = useState<string | null>(null)
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setArchivo(f)
    setError(null)
    setExtraccionMsg(null)
    vibrarTap()

    try {
      // 1. Si es archivo XML (CFDI 3.3 o 4.0 oficial del SAT)
      if (f.name.toLowerCase().endsWith('.xml') || f.type.includes('xml')) {
        const texto = await f.text()
        const cfdi = parsearCfdiXml(texto)
        if (cfdi) {
          if (cfdi.folioCompleto) {
            setFolioFactura(cfdi.folioCompleto)
          }
          if (cfdi.total != null && cfdi.total > 0) {
            setMontoFactura(String(cfdi.total))
          }
          let ligadas = 0
          if (cfdi.conceptos.length > 0 && items.length > 0) {
            const cotejo = cotejarPartidasConOC(
              cfdi.conceptos,
              items.map((it) => ({ id: it.id, nombre: it.nombre, cantidad: it.cantidad }))
            )
            if (cotejo.itemsCoincidentesIds.length > 0) {
              setSelectedItemIds(new Set(cotejo.itemsCoincidentesIds))
              ligadas = cotejo.itemsCoincidentesIds.length
            }
          }
          const partes = [
            `CFDI SAT válido: Folio ${cfdi.folioCompleto || cfdi.uuidFiscal?.slice(0, 8) || 'Detectado'}`,
            cfdi.emisorNombre ? `· ${cfdi.emisorNombre}` : null,
            cfdi.total ? `· $${cfdi.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${cfdi.moneda || 'MXN'}` : null,
            ligadas > 0 ? `· ${ligadas} material(es) cotejado(s) automáticamente` : null,
          ].filter(Boolean)
          setExtraccionMsg(partes.join(' '))
          vibrarExito()
          return
        }
      }

      // 2. Si es PDF o Imagen, analizar heurística del nombre
      const heuristica = extraerDatosDesdeNombreArchivo(f.name)
      if (heuristica.folioSugerido) {
        setFolioFactura(heuristica.folioSugerido)
        setExtraccionMsg(`Folio detectado en archivo: ${heuristica.folioSugerido}`)
        vibrarExito()
      }
    } catch (err) {
      console.warn('Extracción inteligente no concluyente:', err)
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
        setExtraccionMsg(null)
        setFolioFactura('')
        setMontoFactura(totalOrden > 0 ? String(totalOrden) : '')
        setSelectedItemIds(new Set())
        vibrarExito()
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
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Facturas del proveedor
          </h2>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-foreground">
            {facturas.length}
          </span>
        </div>

        {puedeGestionar && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn-secondary btn-xs"
          >
            <IconClip className="h-3.5 w-3.5" />
            <span>Adjuntar factura (PDF)</span>
          </button>
        )}
      </div>

      {facturas.length === 0 ? (
        <div className="card text-center py-6 border-dashed border-input">
          <p className="text-muted-foreground text-xs font-medium">
            No se ha adjuntado ninguna factura a esta orden de compra.
          </p>
          {puedeGestionar && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-2 text-xs font-semibold text-primary hover:underline"
            >
              Subir comprobante fiscal en PDF o imagen
            </button>
          )}
        </div>
      ) : (
        <div className="card divide-y divide-border p-0 overflow-hidden">
          {facturas.map((f) => {
            const abiertos = expandedIds.has(f.id)
            const mats = f.items ?? []
            const titulo =
              f.folio_factura?.trim() ||
              f.archivo_nombre ||
              'Factura'
            return (
              <div key={f.id} className="bg-card">
                <div className="flex items-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => toggleExpand(f.id)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 min-h-[52px]"
                    aria-expanded={abiertos}
                  >
                    <IconChevron
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        abiertos ? 'rotate-90' : ''
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <a
                        href={f.archivo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-sm text-primary hover:underline break-all"
                      >
                        {titulo}
                      </a>
                      <p className="text-xs text-muted-foreground mt-0.5">
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
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-xs font-semibold text-primary hover:underline"
                        title="Abrir XML"
                      >
                        XML
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setQuickLookIndex(facturas.findIndex((x) => x.id === f.id))}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
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
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-muted-foreground hover:text-danger rounded-lg hover:bg-danger-soft disabled:opacity-50"
                        title="Eliminar factura"
                      >
                        <IconBasura className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                {abiertos && (
                  <div className="px-4 pb-3 pl-11 space-y-1.5 bg-muted/50">
                    {mats.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-1">
                        Esta factura no tiene materiales asignados.
                      </p>
                    ) : (
                      mats.map((m) => (
                        <div
                          key={m.orden_item_id}
                          className="flex justify-between gap-2 text-sm py-1 border-b border-border last:border-0"
                        >
                          <span className="text-foreground">{m.nombre}</span>
                          <span className="text-muted-foreground shrink-0 tabular-nums">
                            {m.cantidad} {m.unidad}
                          </span>
                        </div>
                      ))
                    )}
                    <p className="text-[11px] text-muted-foreground pt-1">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/50 backdrop-blur-xs">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl border border-border max-h-[90dvh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground mb-1">
              Adjuntar factura del proveedor
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Sube el PDF y marca qué materiales cubre esta factura.
            </p>

            {error && (
              <div
                className="mb-4 p-3 rounded-lg bg-danger-soft text-danger-soft-foreground text-xs border border-danger/30"
                role="alert"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmitUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Archivo de la Factura (PDF, Imagen o XML) *
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,text/xml,application/xml"
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary-hover border border-input rounded-lg p-1 cursor-pointer"
                />
                {archivo && (
                  <p className="text-[11px] text-primary mt-1 font-medium">
                    Archivo seleccionado: {archivo.name} ({formatBytes(archivo.size)})
                  </p>
                )}
                {extraccionMsg && (
                  <div className="mt-2 p-2.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" />
                    <span className="font-medium leading-snug">{extraccionMsg}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
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
                <label className="block text-xs font-semibold text-foreground mb-1">
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
                  <legend className="text-xs font-semibold text-foreground mb-2">
                    Materiales de esta factura
                  </legend>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {items.map((it) => {
                      const checked = selectedItemIds.has(it.id)
                      return (
                        <label
                          key={it.id}
                          className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleItem(it.id)}
                            className="mt-1"
                          />
                          <span className="min-w-0">
                            <span className="font-medium text-foreground block">{it.nombre}</span>
                            <span className="text-xs text-muted-foreground">
                              {it.cantidad} {it.unidad}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Opcional: deja vacío si aún no repartes materiales.
                  </p>
                </fieldset>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isPending}
                  className="btn-secondary btn-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || !archivo}
                  aria-busy={isPending}
                  className="btn-primary btn-xs"
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
