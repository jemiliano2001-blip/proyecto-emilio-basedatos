import type { Metadata, Viewport } from 'next'
import { AppNav } from '@/components/AppNav'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeVerPrecios } from '@/lib/roles'
import './globals.css'

export const metadata: Metadata = {
  title: 'Proyecto Emilio - Base de Datos',
  description: 'Control de materiales y obras',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#132A45',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionUsuario()
  const showNav = Boolean(session)

  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {children}
        {showNav && (
          <AppNav
            nombre={session?.perfil?.nombre ?? null}
            puedeVerPrecios={puedeVerPrecios(session?.rol ?? null)}
          />
        )}
      </body>
    </html>
  )
}
