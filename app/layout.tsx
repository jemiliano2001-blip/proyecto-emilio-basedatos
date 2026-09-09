import type { Metadata, Viewport } from 'next'
import { AppNav } from '@/components/AppNav'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { TopBar } from '@/components/TopBar'
import { getSessionUsuario } from '@/lib/auth/session'
import {
  puedeGestionarProveedores,
  puedeVerPrecios,
  puedeVerRecepciones,
  puedeVerTraspasos,
} from '@/lib/roles'
import { traspasosSchemaDisponible } from '@/lib/schema-disponible'
import { NetworkStatusIndicator } from '@/components/NetworkStatusIndicator'
import { CommandPalette } from '@/components/CommandPalette'
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal'
import { OfflineUserProvider } from '@/components/OfflineUserProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'ObraTrack — Control de Proyectos y Materiales',
  description: 'Sistema de control, presupuestos y trazabilidad de materiales y proyectos de obra',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#132A45',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionUsuario()
  const showNav = Boolean(session)
  const rol = session?.rol ?? null
  const traspasosDisponibles = showNav ? await traspasosSchemaDisponible() : false

  return (
    <html lang="es">
      <body className="min-h-dvh bg-paper text-gray-900">
        <OfflineUserProvider key={session?.authUserId ?? 'anon'} userId={session?.authUserId ?? null}>
        <NetworkStatusIndicator />
        {showNav && <ServiceWorkerRegistration />}
        {showNav && <TopBar nombre={session?.perfil?.nombre ?? null} />}
        {showNav && <CommandPalette />}
        {showNav && <KeyboardShortcutsModal />}
        {children}
        {showNav && (
          <AppNav
            rol={rol}
            puedeVerPrecios={puedeVerPrecios(rol)}
            puedeVerRecepciones={puedeVerRecepciones(rol)}
            puedeVerTraspasos={puedeVerTraspasos(rol)}
            puedeGestionarProveedores={puedeGestionarProveedores(rol)}
            traspasosDisponibles={traspasosDisponibles}
          />
        )}
      </OfflineUserProvider>
      </body>
    </html>
  )
}
