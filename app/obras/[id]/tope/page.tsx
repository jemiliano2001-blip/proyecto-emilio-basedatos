import { redirect } from 'next/navigation'

export default async function NuevoTopePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  redirect(`/obras/${resolvedparams.id}/asignar-materiales`)
}
