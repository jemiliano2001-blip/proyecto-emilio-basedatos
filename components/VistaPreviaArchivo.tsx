import type { TipoVistaPrevia } from '@/lib/adjuntos'

interface VistaPreviaArchivoProps {
  tipo: TipoVistaPrevia
  nombre: string
  src: string | null
}

/** Vista previa de una imagen o un PDF, antes o después de subirlo. */
export function VistaPreviaArchivo({ tipo, nombre, src }: VistaPreviaArchivoProps) {
  if (tipo === 'xml') {
    return (
      <p className="text-xs text-muted-foreground" data-vista-previa="xml">
        Vista previa no disponible para XML. Se lee el folio al elegirlo.
      </p>
    )
  }

  if (!src || (tipo !== 'imagen' && tipo !== 'pdf')) return null

  if (tipo === 'imagen') {
    return (
      <figure className="overflow-hidden rounded-xl border border-border bg-muted/40" data-vista-previa="imagen">
        {/* blob: y la ruta de la app no están en images.remotePatterns. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- vista local, no el optimizador */}
        <img src={src} alt="Factura" className="max-h-56 w-full object-contain bg-card" />
        <figcaption className="px-3 py-1.5 text-[11px] text-muted-foreground">{nombre}</figcaption>
      </figure>
    )
  }

  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-card" data-vista-previa="pdf">
      <p className="px-3 pt-2 text-xs font-medium text-foreground">{nombre}</p>
      <iframe src={src} title="Vista previa PDF" className="h-56 w-full border-0 bg-card" />
    </figure>
  )
}
