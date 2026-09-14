# Layouts — ObraTrack shell

## Root layout — `app/layout.tsx`

Renders TopBar + children + AppNav when session exists. Body: `min-h-dvh bg-paper`. Theme color `#132A45`.

```tsx
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUsuario()
  const showNav = Boolean(session)
  const rol = session?.rol ?? null
  const traspasosDisponibles = showNav ? await traspasosSchemaDisponible() : false
  return (
    <html lang="es">
      <body className="min-h-dvh bg-paper text-gray-900">
        <OfflineUserProvider userId={session?.authUserId ?? null}>
          <NetworkStatusIndicator />
          {showNav && <ServiceWorkerRegistration />}
          {showNav && <TopBar nombre={session?.perfil?.nombre ?? null} rol={rol} traspasosDisponibles={traspasosDisponibles} />}
          {showNav && <GlobalClientTools rol={rol} userId={session?.authUserId ?? 'anon'} traspasosDisponibles={traspasosDisponibles} />}
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
```

## TopBar — `components/TopBar.tsx`

Sticky `.glass-header`. Left: OT logo mark + ObraTrack (lg+) + section title. Center (md+): horizontal nav by role. Right: command palette search + notification bell. Safe-area top padding.

Active desktop link: `bg-slate-100 text-ink font-bold`.

## AppNav — `components/AppNav.tsx`

Fixed bottom nav, `md:hidden`, blur white bar, safe-area bottom. Tabs ≤5 by role: Proyectos, Solicitudes, Recepción/Inventario/Órdenes, Más. Active today: text weight/color only — **target: teal indicator bar/dot**.

## MoreSheet — `components/MoreSheet.tsx`

Bottom sheet overlay from Más: Catálogo, Órdenes, Traspasos, Proveedores, Inventario, Notificaciones, Logout. Item min-h 48px.
