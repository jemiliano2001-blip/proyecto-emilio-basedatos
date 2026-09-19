import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Poppins } from 'next/font/google'
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

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
  weight: ['600', '700', '800'],
})

const poppins = Poppins({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'ObraTrack — Control de Proyectos y Materiales',
  description: 'Sistema de control, presupuestos y trazabilidad de materiales y proyectos de obra',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/icon-192.png',
  },
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
      className={cn(poppins.variable, playfair.variable)}
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
              showNav && 'lg:pl-sidebar'
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
