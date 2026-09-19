import { NextResponse } from 'next/server'
import { getSessionUsuario } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionUsuario()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = await createClient()

  try {
    // 1. Solicitudes pendientes de compras (recibida / pendiente)
    const { data: reqCompras, error: errCompras } = await supabase
      .from('solicitudes_material')
      .select(`
        id, estado, nota, creado_en,
        obra:obras(id, nombre, fraccionamiento),
        solicitante:usuarios(nombre)
      `)
      .in('estado', ['recibida', 'pendiente'])
      .order('creado_en', { ascending: false })
      .limit(20)

    // 2. Solicitudes pendientes de finanzas (en_proceso / en_cotizacion)
    const { data: reqFinanzas, error: errFinanzas } = await supabase
      .from('solicitudes_material')
      .select(`
        id, estado, nota, creado_en,
        obra:obras(id, nombre, fraccionamiento),
        solicitante:usuarios(nombre)
      `)
      .in('estado', ['en_proceso', 'en_cotizacion'])
      .order('creado_en', { ascending: false })
      .limit(20)

    // 3. Órdenes en tránsito o pendientes de recepción total
    const { data: ordTransito, error: errOrdenes } = await supabase
      .from('ordenes_compra')
      .select(`
        id, folio, folio_fisico, total, moneda, estado, creado_en,
        obra:obras(id, nombre, fraccionamiento),
        proveedor:proveedores(nombre)
      `)
      .in('estado', ['emitida', 'parcialmente_recibida'])
      .order('creado_en', { ascending: false })
      .limit(20)

    if (errCompras || errFinanzas || errOrdenes) {
      console.error('Error al cargar pendientes de abastecimiento:', {
        errCompras,
        errFinanzas,
        errOrdenes,
      })
    }

    return NextResponse.json({
      solicitudesCompras: reqCompras ?? [],
      solicitudesFinanzas: reqFinanzas ?? [],
      ordenesTransito: ordTransito ?? [],
      resumen: {
        totalCompras: (reqCompras ?? []).length,
        totalFinanzas: (reqFinanzas ?? []).length,
        totalTransito: (ordTransito ?? []).length,
        totalGlobal:
          (reqCompras ?? []).length +
          (reqFinanzas ?? []).length +
          (ordTransito ?? []).length,
      },
    })
  } catch (error) {
    console.error('Excepción al consultar abastecimiento:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
