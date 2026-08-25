'use client'

import { useState, useTransition } from 'react'
import { useFormState } from 'react-dom'
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
  const [state, formAction] = useFormState(uploadObraDocumentoAction, initialState)
  const [mostrandoSubida, setMostrandoSubida] = useState(false)
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
          <h2 className="text-base font-bold text-ink">Información Adicional y Documentación</h2>
          <p className="text-xs text-gray-500">
            Presupuestos formales, planos, minutas y conciliaciones en PDF.
          </p>
        </div>
        {puedeGestionar && (
          <button
            type="button"
            onClick={() => setMostrandoSubida((prev) => !prev)}
            className="text-sm font-semibold text-accent hover:underline py-1 px-2"
          >
            {mostrandoSubida ? '✕ Cerrar subida' : '+ Adjuntar PDF'}
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
          className="card border-teal-200 bg-teal-50/40 space-y-3 p-4"
        >
          <input type="hidden" name="obra_id" value={obraId} />

          <h3 className="text-sm font-semibold text-ink">Subir nuevo archivo PDF</h3>

          <div>
            <label htmlFor="nombre_doc" className="block text-xs font-semibold text-gray-700 mb-1">
              Nombre o descripción del documento *
            </label>
            <input
              id="nombre_doc"
              name="nombre"
              required
              placeholder="ej. Presupuesto formal CFE lote 1"
              className="input-base text-sm bg-white"
            />
          </div>

          <div>
            <label htmlFor="tipo_documento" className="block text-xs font-semibold text-gray-700 mb-1">
              Tipo de documento
            </label>
            <select
              id="tipo_documento"
              name="tipo_documento"
              defaultValue="general"
              className="input-base text-sm bg-white"
            >
              {TIPOS_DOCUMENTO_OBRA.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {labelTipoDocumento(tipo)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="archivo" className="block text-xs font-semibold text-gray-700 mb-1">
              Archivo PDF (máx. 30 MB) *
            </label>
            <input
              id="archivo"
              name="archivo"
              type="file"
              accept=".pdf,application/pdf"
              required
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-ink file:text-white hover:file:bg-ink/90 cursor-pointer"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setMostrandoSubida(false)}
              className="btn-secondary px-3 py-2 text-sm"
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
            className="card flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">
                PDF
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-ink text-sm truncate">{doc.nombre}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-gray-500">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
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
              <a
                href={doc.archivo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs px-3 py-2 min-h-[36px] flex items-center gap-1 text-accent border-teal-300 hover:bg-teal-50"
              >
                <span>Ver / Abrir</span>
                <span aria-hidden="true">↗</span>
              </a>

              <a
                href={doc.archivo_url}
                download={doc.nombre.endsWith('.pdf') ? doc.nombre : `${doc.nombre}.pdf`}
                className="btn-secondary text-xs px-3 py-2 min-h-[36px]"
              >
                Descargar
              </a>

              {puedeEliminar && (
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id, doc.nombre)}
                  disabled={isDeleting && deletingId === doc.id}
                  className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 min-h-[36px]"
                  title="Eliminar documento"
                >
                  {isDeleting && deletingId === doc.id ? 'Borrando…' : 'Eliminar'}
                </button>
              )}
            </div>
          </div>
        ))}

        {documentos.length === 0 && (
          <div className="card text-center py-6 text-gray-500 space-y-1">
            <p className="text-sm font-medium">No hay documentos adjuntos en este proyecto.</p>
            <p className="text-xs text-gray-400">
              {puedeGestionar
                ? 'Puedes adjuntar presupuestos formales, planos o minutas en PDF usando el botón de arriba.'
                : 'La oficina aún no ha cargado archivos PDF para este proyecto.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
