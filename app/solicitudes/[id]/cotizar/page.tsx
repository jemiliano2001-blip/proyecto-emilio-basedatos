import { redirect } from 'next/navigation'

/** Ruta histórica: mantiene marcadores sin permitir la OC directa. */
export default async function CotizarSolicitudPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/solicitudes/${id}`)
}
