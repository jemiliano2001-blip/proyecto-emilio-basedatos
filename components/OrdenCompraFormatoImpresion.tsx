'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { IconFlechaAtras, IconImprimir, IconCheck } from '@/components/icons'

interface ItemImpresion {
  id: string
  cantidad: number
  unidad_medida: string
  nombre_material: string
  variante?: string | null
  descripcion?: string | null
  tipo_linea?: string
}

interface OrdenFormatoProps {
  orden: {
    id: string
    folio: string
    folio_fisico?: string | null
    creado_en: string
    moneda: string
    total: number
    solicitante_nombre: string
    proveedor_nombre: string
    obra_nombre: string
    obra_fraccionamiento?: string | null
    autorizado_por: string
    items: ItemImpresion[]
  }
  volverHref?: string
  volverLabel?: string
}

export function OrdenCompraFormatoImpresion({
  orden,
  volverHref,
  volverLabel,
}: OrdenFormatoProps) {
  const [estiloPapel, setEstiloPapel] = useState<'amarillo' | 'blanco'>('amarillo')
  const [copiado, setCopiado] = useState(false)
  const hrefVolver = volverHref ?? `/ordenes/${orden.id}`
  const labelVolver = volverLabel ?? 'Volver a la orden'

  // Formatear fecha en español legible (ej. "2 de septiembre de 2026")
  const fechaObj = new Date(orden.creado_en)
  const fechaFormateada = fechaObj.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Preparar partidas numeradas
  const items = orden.items.map((it) => {
    let descripcionCompleta = ''
    if (it.tipo_linea === 'material' || !it.tipo_linea) {
      const varianteTxt = it.variante ? ` (${it.variante})` : ''
      descripcionCompleta = `${it.cantidad} ${it.unidad_medida} ${it.nombre_material}${varianteTxt}`
    } else {
      descripcionCompleta = `${it.cantidad > 1 ? `${it.cantidad} ` : ''}${it.descripcion || it.nombre_material}`
    }
    return descripcionCompleta
  })

  // Para el formato clásico de 20 líneas en 2 columnas (1 a 10 y 11 a 20)
  const totalSlots = Math.max(20, items.length)
  const halfSlots = Math.ceil(totalSlots / 2)
  const columna1 = Array.from({ length: halfSlots }, (_, i) => ({
    num: i + 1,
    texto: items[i] || '',
  }))
  const columna2 = Array.from({ length: halfSlots }, (_, i) => {
    const idx = halfSlots + i
    return {
      num: idx + 1,
      texto: items[idx] || '',
    }
  })

  // Generar texto para WhatsApp
  const handleCopiarWhatsApp = () => {
    const folioStr = orden.folio_fisico ? `${orden.folio} (Talonario: ${orden.folio_fisico})` : orden.folio
    let texto = `*GRUPO GARZA-ESCOBEDO, S.A. DE C.V.*\n`
    texto += `*ORDEN DE COMPRA:* ${folioStr}\n`
    texto += `*FECHA:* ${fechaFormateada}\n`
    texto += `*PROVEEDOR:* ${orden.proveedor_nombre || 'Pendiente'}\n`
    texto += `*OBRA:* ${orden.obra_nombre}\n`
    texto += `*SOLICITANTE:* ${orden.solicitante_nombre}\n\n`
    texto += `*LISTADO DE MATERIALES:*\n`
    items.forEach((it, idx) => {
      texto += `${idx + 1}.- ${it}\n`
    })
    texto += `\n*AUTORIZÓ:* ${orden.autorizado_por}`

    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 3000)
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const folioMostrado = orden.folio_fisico || orden.folio

  return (
    <div className="min-h-screen bg-paper py-6 px-4 print:p-0 print:bg-white">
      {/* Barra de Controles superior (Oculta al imprimir) */}
      <div className="card max-w-4xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 p-4 shadow-xs border border-rule print:hidden">
        <div className="flex items-center gap-2">
          <Link
            href={hrefVolver}
            className="text-sm font-semibold text-accent hover:underline inline-flex items-center gap-1"
          >
            <IconFlechaAtras className="w-4 h-4" />
            <span>{labelVolver}</span>
          </Link>
          <span className="text-muted">|</span>
          <span className="text-xs font-bold px-2.5 py-1 rounded bg-ink text-white">
            {orden.folio}
          </span>
          {orden.folio_fisico && (
            <span className="badge-amber">
              No. Físico: {orden.folio_fisico}
            </span>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Toggle Papel */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-medium border border-rule">
            <button
              type="button"
              onClick={() => setEstiloPapel('amarillo')}
              className={`px-2.5 py-1 rounded-lg ${
                estiloPapel === 'amarillo'
                  ? 'bg-amber-100 text-amber-900 font-bold shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Papel Amarillo
            </button>
            <button
              type="button"
              onClick={() => setEstiloPapel('blanco')}
              className={`px-2.5 py-1 rounded-lg ${
                estiloPapel === 'blanco'
                  ? 'bg-white text-ink font-bold shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Blanco / Impresión
            </button>
          </div>

          {/* Botón WhatsApp */}
          <button
            type="button"
            onClick={handleCopiarWhatsApp}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
          >
            {copiado ? (
              <>
                <IconCheck className="w-3.5 h-3.5" />
                <span>¡Copiado!</span>
              </>
            ) : (
              <span>Copiar para WhatsApp</span>
            )}
          </button>

          {/* Botón Imprimir / PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="btn-primary text-xs inline-flex items-center gap-1.5"
          >
            <IconImprimir className="w-3.5 h-3.5" />
            <span>Imprimir / Guardar PDF</span>
          </button>
        </div>
      </div>

      {/* Hoja membretada oficial (Réplica exacta de la "Hojita Amarilla") */}
      <div
        className={`max-w-[215mm] min-h-[279mm] mx-auto p-8 sm:p-10 shadow-lg border print:shadow-none print:border-none print:m-0 print:p-8 print:w-full transition-colors duration-200 ${
          estiloPapel === 'amarillo'
            ? 'bg-[#FEFCE8] text-slate-900 border-amber-200/80'
            : 'bg-white text-slate-900 border-slate-300'
        }`}
        style={{
          fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
        }}
      >
        {/* Encabezado Superior */}
        <div className="flex justify-between items-start gap-4 pb-4 border-b-2 border-slate-900">
          {/* Logo y Datos de la Empresa */}
          <div className="flex items-start gap-3 flex-1">
            {/* Logotipo GE estilizado */}
            <div className="shrink-0 w-16 h-16 border-2 border-slate-900 rounded flex flex-col items-center justify-center p-1 bg-white/40">
              <span className="font-serif font-black text-2xl tracking-tighter text-slate-900 leading-none">
                GE
              </span>
              <span className="text-[7px] font-bold uppercase tracking-widest text-slate-800 mt-1">
                GARZA-ESCOBEDO
              </span>
            </div>

            {/* Texto membretado */}
            <div>
              <h1 className="font-extrabold text-base tracking-wide uppercase text-slate-900 leading-snug">
                GRUPO GARZA-ESCOBEDO, S.A. DE C.V.
              </h1>
              <p className="text-xs font-bold tracking-widest uppercase text-slate-800">
                CONSTRUCTORES ELÉCTRICOS
              </p>
              <p className="text-[10px] text-slate-700 leading-tight mt-0.5">
                AVE. DEL MAESTRO No.4 ENTRE JUAN J. SOLERNAU Y PRIV. LAREDO
              </p>
              <p className="text-[10px] text-slate-700 leading-tight">
                COL. BERTHA DEL AVELLANO H. MATAMOROS, TAM. C.P. 87438
              </p>
              <p className="text-[10px] font-medium text-slate-800 leading-tight mt-0.5">
                TEL: (868) 817-1406 &nbsp;·&nbsp; TEL./FAX: (868) 817-2958
              </p>
              <p className="text-[10.5px] font-bold text-slate-900 mt-0.5">
                RFC: GGA070518QZ7
              </p>
            </div>
          </div>

          {/* Bloque Superior Derecho: Orden de Compra y Fecha */}
          <div className="text-right shrink-0">
            <div className="border-2 border-slate-900 px-3 py-1.5 rounded bg-white/60 text-center min-w-[170px]">
              <span className="block text-[11px] font-extrabold tracking-wider uppercase text-slate-900">
                ORDEN DE COMPRA
              </span>
              <span className="block text-lg font-black tracking-tight text-red-700">
                No &nbsp;{folioMostrado}
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-800 mt-2">
              <strong className="font-bold">FECHA:</strong> {fechaFormateada}
            </p>
          </div>
        </div>

        {/* Metadatos de la Orden: Solicitante, Proveedor, Obra */}
        <div className="mt-4 space-y-1.5 text-xs">
          <div className="flex items-baseline gap-2">
            <span className="font-bold uppercase tracking-wide text-slate-900 min-w-[170px]">
              NOMBRE DEL SOLICITANTE:
            </span>
            <span className="font-medium text-slate-800 uppercase flex-1 border-b border-slate-400 pb-0.5">
              {orden.solicitante_nombre || '—'}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-bold uppercase tracking-wide text-slate-900 min-w-[170px]">
              NOMBRE DEL PROVEEDOR:
            </span>
            <span className="font-medium text-slate-800 uppercase flex-1 border-b border-slate-400 pb-0.5">
              {orden.proveedor_nombre || 'A DETERMINAR'}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-bold uppercase tracking-wide text-slate-900 min-w-[170px]">
              OBRA:
            </span>
            <span className="font-medium text-slate-800 uppercase flex-1 border-b border-slate-400 pb-0.5">
              {orden.obra_nombre}
              {orden.obra_fraccionamiento ? ` · ${orden.obra_fraccionamiento}` : ''}
            </span>
          </div>
        </div>

        {/* Listado de Materiales (Grilla de 20 líneas numeradas) */}
        <div className="mt-6">
          <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-2">
            LISTADO DE MATERIALES:
          </h2>

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {/* Columna 1 (1 al 10 o mitad) */}
            <div className="space-y-1">
              {columna1.map((c) => (
                <div key={c.num} className="flex items-baseline gap-1.5 border-b border-slate-300/80 pb-0.5 min-h-[22px]">
                  <span className="font-bold text-slate-900 w-8 shrink-0 tabular-nums">
                    {c.num}.-
                  </span>
                  <span className="text-slate-800 font-medium truncate flex-1">
                    {c.texto}
                  </span>
                </div>
              ))}
            </div>

            {/* Columna 2 (11 al 20 o segunda mitad) */}
            <div className="space-y-1">
              {columna2.map((c) => (
                <div key={c.num} className="flex items-baseline gap-1.5 border-b border-slate-300/80 pb-0.5 min-h-[22px]">
                  <span className="font-bold text-slate-900 w-8 shrink-0 tabular-nums">
                    {c.num}.-
                  </span>
                  <span className="text-slate-800 font-medium truncate flex-1">
                    {c.texto}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sección Inferior: Autorización y Firma */}
        <div className="mt-12 pt-4 flex justify-end">
          <div className="w-64 text-center">
            {/* Espacio para firma / sello */}
            <div className="h-14 flex items-end justify-center pb-1">
              <span
                className="text-xl text-blue-900 font-serif italic font-bold select-none tracking-wide"
                style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive, sans-serif" }}
              >
                {orden.autorizado_por || 'Thalía'}
              </span>
            </div>
            <div className="border-t-2 border-slate-900 pt-1">
              <span className="font-extrabold text-xs uppercase tracking-widest text-slate-900">
                AUTORIZÓ:
              </span>
              <p className="text-[11px] font-semibold text-slate-700 capitalize mt-0.5">
                {orden.autorizado_por || 'Compras'}
              </p>
            </div>
          </div>
        </div>

        {/* Pie de página institucional discreto */}
        <div className="mt-8 pt-3 border-t border-slate-300 flex justify-between items-center text-[9px] text-slate-500">
          <span>Sistema de Control de Obras y Materiales · Grupo Garza-Escobedo</span>
          <span>Folio Interno: {orden.folio}</span>
        </div>
      </div>
    </div>
  )
}
