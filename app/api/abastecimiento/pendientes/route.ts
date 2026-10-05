import { NextResponse } from 'next/server'
import { getSessionUsuario } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { tabsAbastecimiento } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionUsuario()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const tabs = tabsAbastecimiento(session.rol)
  if (tabs.length === 0) return NextResponse.json({ error: 'Sin permiso para abastecimiento.' }, { status: 403 })

  const supabase = await createClient()

  try {
    // 1. Solicitudes pendientes de compras (recibida / pendiente)
    const { data: reqCompras, error: errCompras, count: cntCompras } = tabs.includes('compras') ? await supabase
      .from('solicitudes_material')
      .select(`
        id, estado, nota, creado_en,
        obra:obras(id, nombre, fraccionamiento),
        solicitante:usuarios(nombre)
      `, { count: 'exact' })
      .in('estado', ['recibida', 'pendiente'])
      .order('creado_en', { ascending: false })
      .limit(20) : { data: [], error: null, count: 0 }

    // 2. Solicitudes pendientes de finanzas (en_proceso / en_cotizacion)
    const { data: reqFinanzas, error: errFinanzas, count: cntFinanzas } = tabs.includes('finanzas') ? await supabase
      .from('solicitudes_material')
      .select(`
        id, estado, nota, creado_en,
        obra:obras(id, nombre, fraccionamiento),
        solicitante:usuarios(nombre)
      `, { count: 'exact' })
      .in('estado', ['en_proceso', 'en_cotizacion'])
      .order('creado_en', { ascending: false })
      .limit(20) : { data: [], error: null, count: 0 }

    // 3. Órdenes en tránsito o pendientes de recepción total
    const { data: ordTransito, error: errOrdenes, count: cntTransito } = await supabase
      .from('ordenes_compra')
      .select(`
        id, folio, folio_fisico, total, moneda, estado, creado_en,
        obra:obras(id, nombre, fraccionamiento),
        proveedor:proveedores(nombre)
      `, { count: 'exact' })
      .in('estado', ['emitida', 'parcialmente_recibida'])
      .order('creado_en', { ascending: false })
      .limit(20)

    // Antes se respondía 200 con listas vacías y el drawer decía "no hay pendientes".
    if (errCompras || errFinanzas || errOrdenes) {
      console.error('Error al cargar pendientes de abastecimiento:', {
        errCompras,
        errFinanzas,
        errOrdenes,
      })
      return NextResponse.json(
        { error: 'No se pudieron cargar los pendientes de abastecimiento.' },
        { status: 500 }
      )
    }

    // Las listas traen 20 registros; los contadores usan el total real.
    const totalCompras = cntCompras ?? (reqCompras ?? []).length
    const totalFinanzas = cntFinanzas ?? (reqFinanzas ?? []).length
    const totalTransito = cntTransito ?? (ordTransito ?? []).length

    return NextResponse.json({
      solicitudesCompras: reqCompras ?? [],
      solicitudesFinanzas: reqFinanzas ?? [],
      ordenesTransito: ordTransito ?? [],
      resumen: {
        totalCompras,
        totalFinanzas,
        totalTransito,
        totalGlobal: totalCompras + totalFinanzas + totalTransito,
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
