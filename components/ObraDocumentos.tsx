'use client'

import { useActionState, useState, useTransition } from 'react'
import {
  uploadObraDocumentoAction,
  deleteObraDocumentoAction,
  type DocumentoActionResult,
} from '@/lib/actions/documentos'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import {
  TIPOS_DOCUMENTO_OBRA,
  labelTipoDocumento,
} from '@/lib/validations/documento'
import type { ObraDocumento } from '@/lib/types'
import { EmptyState } from '@/components/EmptyState'
import { IconDocumento, IconExterno, IconPlus } from '@/components/icons'
import dynamic from 'next/dynamic'

const QuickLookModal = dynamic(
  () => import('@/components/QuickLookModal').then((mod) => mod.QuickLookModal),
  { ssr: false }
)

const initialState: DocumentoActionResult = { error: null }

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return 'Tamaño desconocido'
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(2)} MB`
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function ObraDocumentos({
  obraId,
  documentos = [],
  puedeGestionar = false,
  puedeEliminar = false,
}: {
  obraId: string
  documentos: ObraDocumento[]
  puedeGestionar?: boolean
  puedeEliminar?: boolean
}) {
  const [state, formAction] = useActionState(uploadObraDocumentoAction, initialState)
  const [mostrandoSubida, setMostrandoSubida] = useState(false)
  const [quickLookIndex, setQuickLookIndex] = useState<number | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleDelete(docId: string, docNombre: string) {
    if (!window.confirm(`¿Estás seguro de eliminar el documento "${docNombre}"?`)) {
      return
    }
    setDeleteError(null)
    setDeletingId(docId)
    startDeleteTransition(async () => {
      const res = await deleteObraDocumentoAction(docId, obraId)
      if (res.error) {
        setDeleteError(res.error)
      }
      setDeletingId(null)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Información Adicional y Documentación</h2>
          <p className="text-xs text-muted-foreground">
            Presupuestos formales, planos, minutas y conciliaciones en PDF.
          </p>
        </div>
        {puedeGestionar && (
          <button
            type="button"
            onClick={() => setMostrandoSubida((prev) => !prev)}
            className="text-xs font-semibold text-primary hover:underline py-1 px-2 inline-flex items-center gap-1"
          >
            {mostrandoSubida ? (
              <span>Cerrar subida</span>
            ) : (
              <>
                <IconPlus className="w-3.5 h-3.5" />
                <span>Adjuntar PDF</span>
              </>
            )}
          </button>
        )}
      </div>

      <FormError message={state.error ?? deleteError} />

      {puedeGestionar && mostrandoSubida && (
        <form
          action={async (formData) => {
            formAction(formData)
            // Si no hay error tras enviar, podemos cerrar el formulario
          }}
          className="card border-primary/30 bg-primary-soft/40 space-y-3 p-4"
        >
          <input type="hidden" name="obra_id" value={obraId} />

          <h3 className="text-sm font-semibold text-foreground">Subir nuevo archivo PDF</h3>

          <div>
            <label htmlFor="nombre_doc" className="block text-xs font-semibold text-foreground mb-1">
              Nombre o descripción del documento *
            </label>
            <input
              id="nombre_doc"
              name="nombre"
              required
              placeholder="ej. Presupuesto formal CFE lote 1"
              className="input-base text-sm bg-card"
            />
          </div>

          <div>
            <label htmlFor="tipo_documento" className="block text-xs font-semibold text-foreground mb-1">
              Tipo de documento
            </label>
            <select
              id="tipo_documento"
              name="tipo_documento"
              defaultValue="general"
              className="input-base text-sm bg-card"
            >
              {TIPOS_DOCUMENTO_OBRA.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {labelTipoDocumento(tipo)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="archivo" className="block text-xs font-semibold text-foreground mb-1">
              Archivo PDF (máx. 30 MB) *
            </label>
            <input
              id="archivo"
              name="archivo"
              type="file"
              accept=".pdf,application/pdf"
              required
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary-hover cursor-pointer"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setMostrandoSubida(false)}
              className="btn-secondary btn-sm"
            >
              Cancelar
            </button>
            <SubmitButton>Subir documento</SubmitButton>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {documentos.map((doc) => (
          <div
            key={doc.id}
            className="card flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:border-input transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-danger-soft text-danger-soft-foreground flex items-center justify-center font-bold text-xs">
                PDF
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm truncate">{doc.nombre}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-foreground font-medium">
                    {labelTipoDocumento(doc.tipo_documento)}
                  </span>
                  <span>•</span>
                  <span>{formatBytes(doc.tamano_bytes)}</span>
                  <span>•</span>
                  <span>{formatDate(doc.creado_en)}</span>
                  {doc.subido_por_nombre && (
                    <>
                      <span>•</span>
                      <span>Por: {doc.subido_por_nombre}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => setQuickLookIndex(documentos.findIndex((d) => d.id === doc.id))}
                className="btn-secondary btn-sm min-h-[44px] text-primary border-primary/40 hover:bg-primary-soft cursor-pointer"
              >
                <span>Vista previa</span>
                <IconExterno className="size-3.5" />
              </button>

              <a
                href={doc.archivo_url}
                download={doc.nombre.endsWith('.pdf') ? doc.nombre : `${doc.nombre}.pdf`}
                className="btn-secondary btn-sm min-h-[44px]"
              >
                Descargar
              </a>

              {puedeEliminar && (
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id, doc.nombre)}
                  disabled={isDeleting && deletingId === doc.id}
                  className="text-sm text-danger hover:text-danger-soft-foreground font-medium px-3 py-2 min-h-[44px]"
                  title="Eliminar documento"
                >
                  {isDeleting && deletingId === doc.id ? 'Borrando…' : 'Eliminar'}
                </button>
              )}
            </div>
          </div>
        ))}

        {documentos.length === 0 && (
          <EmptyState
            icon={<IconDocumento className="w-7 h-7" />}
            title="Sin documentos adjuntos"
            description={
              puedeGestionar
                ? 'Puedes adjuntar presupuestos formales, planos o minutas en PDF usando el botón de arriba.'
                : 'La oficina aún no ha cargado archivos PDF para este proyecto.'
            }
          />
        )}
      </div>

      {/* Visor QuickLook Modal para PDFs del proyecto */}
      <QuickLookModal
        open={quickLookIndex !== null}
        initialIndex={quickLookIndex ?? 0}
        onClose={() => setQuickLookIndex(null)}
        items={documentos.map((d) => ({
          url: d.archivo_url,
          nombre: d.nombre,
          tipo: 'pdf',
          tamano: formatBytes(d.tamano_bytes),
          subidoPor: d.subido_por_nombre,
          fecha: formatDate(d.creado_en),
        }))}
      />
    </div>
  )
}
