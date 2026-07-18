'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAction } from '@/lib/actions/auth'

export function AppNav({
  nombre,
  puedeVerPrecios,
}: {
  nombre: string | null
  puedeVerPrecios: boolean
}) {
  const pathname = usePathname()

  const linkClass = (href: string) => {
    const active =
      href === '/'
        ? pathname === '/' || pathname.startsWith('/obras')
        : pathname === href || pathname.startsWith(`${href}/`)
    return `flex-1 text-center py-3 text-sm font-semibold ${
      active
        ? 'text-[#132A45] border-t-2 border-[#132A45]'
        : 'text-gray-500 border-t-2 border-transparent'
    }`
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-20">
      <div className="max-w-2xl mx-auto flex items-stretch">
        <Link href="/" className={linkClass('/')}>
          Obras
        </Link>
        <Link href="/materiales" className={linkClass('/materiales')}>
          Materiales
        </Link>
        <Link href="/solicitudes" className={linkClass('/solicitudes')}>
          Solicitudes
        </Link>
        {puedeVerPrecios && (
          <Link href="/ordenes" className={linkClass('/ordenes')}>
            Órdenes
          </Link>
        )}
        <form action={logoutAction} className="flex-1">
          <button
            type="submit"
            className="w-full py-3 text-sm font-semibold text-gray-500 border-t-2 border-transparent"
            title={nombre ?? 'Cerrar sesión'}
          >
            Salir
          </button>
        </form>
      </div>
    </nav>
  )
}
