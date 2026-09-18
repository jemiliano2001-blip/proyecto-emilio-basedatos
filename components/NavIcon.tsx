import type { SVGProps } from 'react'
import {
  IconBitacora,
  IconMateriales,
  IconOrdenes,
  IconPaquete,
  IconProveedores,
  IconProyectos,
  IconRayo,
  IconRecepcion,
  IconSolicitudes,
  IconTraspasos,
  IconUsuarios,
} from '@/components/icons'
import type { NavIconId } from '@/lib/nav'

const ICONS: Record<NavIconId, (props: SVGProps<SVGSVGElement>) => JSX.Element> = {
  proyectos: IconProyectos,
  solicitudes: IconSolicitudes,
  recepcion: IconRecepcion,
  paquete: IconPaquete,
  traspasos: IconTraspasos,
  ordenes: IconOrdenes,
  materiales: IconMateriales,
  rayo: IconRayo,
  proveedores: IconProveedores,
  usuarios: IconUsuarios,
  bitacora: IconBitacora,
}

export function NavIcon({ id, className }: { id: NavIconId; className?: string }) {
  const Icon = ICONS[id]
  return <Icon className={className} />
}
