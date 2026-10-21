import Link from 'next/link'
import { etiquetaLlegadaPedido } from '@/lib/checklist-recepcion'

export interface PedidoLlegado {
  id: string
  folio: string
  obra_nombre: string
  estado: string
}

export function ListaPedidosLlegados({ pedidos }: { pedidos: PedidoLlegado[] }) {
  if (pedidos.length === 0) {
    return <p className="text-base text-foreground">No hay pedidos por recibir.</p>
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {pedidos.map((orden) => (
        <Link
          key={orden.id}
          href={`/ordenes/${orden.id}/recibir`}
          className="flex min-h-14 w-full flex-col justify-center gap-1 rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground"
        >
          <span className="font-semibold">{orden.folio}</span>
          <span>{orden.obra_nombre}</span>
          <span className="text-muted-foreground">{etiquetaLlegadaPedido(orden.estado)}</span>
        </Link>
      ))}
    </div>
  )
}
