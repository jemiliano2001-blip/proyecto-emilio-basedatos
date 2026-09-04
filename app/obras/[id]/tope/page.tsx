import { redirect } from 'next/navigation'

export default function NuevoTopePage({
  params,
}: {
  params: { id: string }
}) {
  redirect(`/obras/${params.id}/asignar-materiales`)
}
