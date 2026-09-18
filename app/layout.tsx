import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import { AppNav } from '@/components/AppNav'
import { AppSidebar } from '@/components/AppSidebar'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { TopBar } from '@/components/TopBar'
import { getSessionUsuario } from '@/lib/auth/session'
import { SIDEBAR_COOKIE } from '@/lib/nav'
import { traspasosSchemaDisponible } from '@/lib/schema-disponible'
import { NetworkStatusIndicator } from '@/components/NetworkStatusIndicator'
import { GlobalClientTools } from '@/components/GlobalClientTools'
import { OfflineUserProvider } from '@/components/OfflineUserProvider'
import { ToastUndoContainer } from '@/components/ToastUndoContainer'
import { cn } from '@/lib/utils'
import './globals.css'

// Self-hosted en build: se sirve desde /_next/static (sin request a Google)
// y el service worker lo cachea como cualquier asset estático.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'ObraTrack — Control de Proyectos y Materiales',
  description: 'Sistema de control, presupuestos y trazabilidad de materiales y proyectos de obra',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
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
  const cookieStore = await cookies()
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === '1'

  return (
    <html
      lang="es"
      className={inter.variable}
      data-sidebar={showNav ? (sidebarCollapsed ? 'collapsed' : 'expanded') : undefined}
    >
      <body className="min-h-dvh bg-background text-foreground">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
        >
          Saltar al contenido
        </a>
        <OfflineUserProvider key={session?.authUserId ?? 'anon'} userId={session?.authUserId ?? null}>
          <NetworkStatusIndicator />
          {showNav && <ServiceWorkerRegistration />}
          {showNav && (
            <AppSidebar
              rol={rol}
              nombre={session?.perfil?.nombre ?? null}
              email={session?.email ?? null}
              traspasosDisponibles={traspasosDisponibles}
              defaultCollapsed={sidebarCollapsed}
            />
          )}
          {showNav && <GlobalClientTools rol={rol} userId={session?.authUserId ?? 'anon'} traspasosDisponibles={traspasosDisponibles} />}
          <div
            className={cn(
              'app-content flex min-h-dvh flex-col',
              showNav && 'lg:pl-sidebar lg:transition-[padding] lg:duration-200 lg:ease-out'
            )}
          >
            {showNav && <TopBar nombre={session?.perfil?.nombre ?? null} />}
            <div id="contenido" className="flex-1">
              {children}
            </div>
          </div>
          <ToastUndoContainer />
          {showNav && <AppNav rol={rol} traspasosDisponibles={traspasosDisponibles} />}
        </OfflineUserProvider>
      </body>
    </html>
  )
}
