import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { getSessionUsuario } from '@/lib/auth/session'
import { formatMoneyMx } from '@/lib/money'
import { puedeGestionarCatalogo, puedeVerPrecios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { CatalogoMaterial } from '@/lib/types'

function precioNumero(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export default async function MaterialDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  const rol = session?.rol ?? null
  const puedeEditar = puedeGestionarCatalogo(rol)
  const verPrecios = puedeVerPrecios(rol)
  const supabase = await createClient()

  const columnas =
    'id, nombre_base, variante, unidad_medida, categoria, subcategoria, especificacion, foto_url, activo'
  const { data } = await supabase
    .from('catalogo_materiales_lectura')
    .select(verPrecios ? `${columnas}, precio_base` : columnas)
    .eq('id', resolvedparams.id)
    .maybeSingle()

  const material = data as CatalogoMaterial | null
  if (!material) notFound()

  const contexto = [material.categoria, material.subcategoria].filter(Boolean).join(' · ')
  const precio = verPrecios ? precioNumero(material.precio_base) : null

  return (
    <main className="page-shell-narrow">
      <PageHeader
        title={material.nombre_base}
        description={material.variante ? `Variante: ${material.variante}` : undefined}
        eyebrow={contexto || 'Catálogo'}
        backHref="/materiales"
        backLabel="Volver al catálogo"
        badge={
          <Badge variant={material.activo ? 'success' : 'warning'} dot>
            {material.activo ? 'Activo' : 'Inactivo'}
          </Badge>
        }
        actions={
          puedeEditar ? (
            <Link href={`/materiales/${material.id}/editar`} className="btn-secondary btn-sm">
              Editar
            </Link>
          ) : undefined
        }
      />

      {material.foto_url && (
        <div className="relative mb-6 h-44 overflow-hidden rounded-2xl border border-border/80 bg-muted/40 sm:h-56">
          <Image
            src={material.foto_url}
            alt={material.nombre_base}
            fill
            unoptimized
            className="object-cover"
          />
        </div>
      )}

      <section className="card">
        <h2 className="card-title mb-3">Ficha del material</h2>
        <dl className="divide-y divide-border/60 text-sm">
          <div className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
            <dt className="font-medium text-muted-foreground">Unidad</dt>
            <dd className="text-right font-semibold text-foreground">{material.unidad_medida}</dd>
          </div>
          <div className="flex items-start justify-between gap-3 py-2.5">
            <dt className="font-medium text-muted-foreground">Categoría</dt>
            <dd className="text-right font-semibold text-foreground">
              {material.categoria || 'Sin categoría'}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3 py-2.5">
            <dt className="font-medium text-muted-foreground">Subcategoría</dt>
            <dd className="text-right font-semibold text-foreground">
              {material.subcategoria || 'Sin subcategoría'}
            </dd>
          </div>
          {verPrecios && (
            <div className="flex items-start justify-between gap-3 py-2.5">
              <dt className="font-medium text-muted-foreground">Precio base</dt>
              <dd className="text-right font-semibold tabular-nums text-foreground">
                {precio === null ? 'Sin precio' : formatMoneyMx(precio)}
              </dd>
            </div>
          )}
          <div className="py-2.5 last:pb-0">
            <dt className="font-medium text-muted-foreground">Especificación</dt>
            <dd className="mt-1 whitespace-pre-line text-foreground">
              {material.especificacion?.trim()
                ? material.especificacion
                : 'Sin especificación registrada.'}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  )
}
