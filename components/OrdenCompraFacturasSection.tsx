'use client'

import React, { useState, useTransition, useRef } from 'react'
import type { OrdenCompraFactura } from '@/lib/types'
import { eliminarFacturaOrdenAction, subirFacturaOrdenAction } from '@/lib/actions/ordenes'

interface Props {
  ordenId: string
  obraId: string
  totalOrden: number
  moneda: string
  facturas: OrdenCompraFactura[]
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
  puedeGestionar,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [folioFactura, setFolioFactura] = useState('')
  const [montoFactura, setMontoFactura] = useState<string>(totalOrden > 0 ? String(totalOrden) : '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

      const res = await subirFacturaOrdenAction({ error: null }, formData)
      if (res.error) {
        setError(res.error)
      } else {
        setModalOpen(false)
        setArchivo(null)
        setFolioFactura('')
        setMontoFactura(totalOrden > 0 ? String(totalOrden) : '')
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
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {facturas.length}
          </span>
        </div>

        {puedeGestionar && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-xs font-bold text-[#1E7F7A] bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-teal-200"
          >
            📎 Adjuntar factura (PDF)
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
              className="mt-2 text-xs font-semibold text-[#1E7F7A] hover:underline"
            >
              + Subir comprobante fiscal en PDF o imagen
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {facturas.map((f) => (
            <div
              key={f.id}
              className="card flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs shrink-0 border border-red-100">
                  {f.tipo_archivo === 'pdf' ? 'PDF' : f.tipo_archivo === 'xml' ? 'XML' : 'IMG'}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-[#132A45] break-all">
                      {f.archivo_nombre}
                    </p>
                    {f.folio_factura && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        Folio: {f.folio_factura}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                    <span>{formatBytes(f.tamano_bytes)}</span>
                    <span>·</span>
                    <span>{new Date(f.creado_en).toLocaleDateString('es-MX')}</span>
                    {f.monto_factura !== null && f.monto_factura !== undefined && (
                      <>
                        <span>·</span>
                        <span className="font-semibold text-slate-700">
                          ${Number(f.monto_factura).toLocaleString('es-MX', { minimumFractionDigits: 2 })} {moneda}
                        </span>
                      </>
                    )}
                    {f.subido_por_nombre && (
                      <>
                        <span>·</span>
                        <span className="text-gray-400">Por {f.subido_por_nombre}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <a
                  href={f.archivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  👁️ Ver documento
                </a>

                {puedeGestionar && (
                  <button
                    type="button"
                    onClick={() => handleEliminar(f.id)}
                    disabled={deletingId === f.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Eliminar factura"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal para adjuntar factura */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-[#132A45] mb-1">
              Adjuntar factura del proveedor
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Sube el archivo PDF o fotografía de la factura correspondiente a esta orden de compra.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
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
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-[#1E7F7A] hover:file:bg-teal-100 border border-gray-300 rounded-xl p-1 cursor-pointer"
                />
                {archivo && (
                  <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                    ✓ Archivo seleccionado: {archivo.name} ({formatBytes(archivo.size)})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Folio o Número de Factura (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. F-14329 o UUID del SAT"
                  value={folioFactura}
                  onChange={(e) => setFolioFactura(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E7F7A]"
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
                  className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E7F7A]"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Total de la orden: ${Number(totalOrden).toLocaleString('es-MX', { minimumFractionDigits: 2 })} {moneda}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || !archivo}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#1E7F7A] hover:bg-[#16605d] transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Subiendo factura...' : 'Subir factura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
