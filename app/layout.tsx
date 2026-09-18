import type { Metadata, Viewport } from 'next'
import { AppNav } from '@/components/AppNav'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { TopBar } from '@/components/TopBar'
import { getSessionUsuario } from '@/lib/auth/session'
import {
  puedeGestionarProveedores,
  puedeGestionarUsuarios,
  puedeVerBitacora,
  puedeVerPrecios,
  puedeVerRecepciones,
  puedeVerTraspasos,
} from '@/lib/roles'
import { traspasosSchemaDisponible } from '@/lib/schema-disponible'
import { NetworkStatusIndicator } from '@/components/NetworkStatusIndicator'
import { GlobalClientTools } from '@/components/GlobalClientTools'
import { OfflineUserProvider } from '@/components/OfflineUserProvider'
import { ToastUndoContainer } from '@/components/ToastUndoContainer'
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
  const showNav = Boolean(session?.perfil && session.rol)
  const rol = session?.rol ?? null
  const traspasosDisponibles = showNav ? await traspasosSchemaDisponible() : false

  return (
    <html lang="es">
      <body className="min-h-dvh bg-paper text-foreground">
        <OfflineUserProvider key={session?.authUserId ?? 'anon'} userId={session?.authUserId ?? null}>
          <NetworkStatusIndicator />
          {showNav && <ServiceWorkerRegistration />}
          {showNav && <TopBar nombre={session?.perfil?.nombre ?? null} rol={rol} traspasosDisponibles={traspasosDisponibles} />}
          {showNav && <GlobalClientTools rol={rol} userId={session?.authUserId ?? 'anon'} traspasosDisponibles={traspasosDisponibles} />}
          {children}
          <ToastUndoContainer />
          {showNav && (
            <AppNav
              rol={rol}
              puedeVerPrecios={puedeVerPrecios(rol)}
              puedeVerRecepciones={puedeVerRecepciones(rol)}
              puedeVerTraspasos={puedeVerTraspasos(rol)}
              puedeGestionarProveedores={puedeGestionarProveedores(rol)}
              puedeGestionarUsuarios={puedeGestionarUsuarios(rol)}
              puedeVerBitacora={puedeVerBitacora(rol)}
              traspasosDisponibles={traspasosDisponibles}
            />
          )}
        </OfflineUserProvider>
      </body>
    </html>
  )
}
