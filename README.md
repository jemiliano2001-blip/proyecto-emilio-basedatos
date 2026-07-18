# Proyecto Emilio - Base de Datos

Sistema de trazabilidad de materiales y obras. Next.js 14 + Supabase (PostgreSQL).

## Estado actual: Fase 3 completa (Cotización y Órdenes de Compra)

### Fase 0 — Infraestructura (hecha)
- Proyecto Supabase: `proyecto-emilio-basedatos` (ref `uplxxnpurpqlvhjrsufa`)
- Migraciones aplicadas: `0001` … `0004b`
- `.env.local` con URL + anon key (no subir a git)
- Usuarios de prueba sembrados (ver abajo)

Pendiente operativo (dashboard, no código):
- [ ] Activar backups automáticos (Settings → Database → Backups) — requiere plan Pro
- [ ] Activar "Leaked password protection" en Auth
- [ ] Reemplazar íconos PWA placeholder por logo real de la empresa

### Fase 1 — Catálogo + Obras + Topes
- Login individual (`/login`) + middleware de sesión
- CRUD obras y materiales
- Topes contratados + vista `v_saldo_material_obra` (usado = 0 hasta Fase 5)

### Fase 2 — Solicitudes de campo (cerrada)
- Migración `0003_solicitudes_material.sql` aplicada (con DELETE, trigger anti-manipulación, notificaciones por rol)
- Personal crea/cancela solicitudes; Compras/Proyectos/Operación las ven todas
- Nav: Obras | Materiales | Solicitudes | (Órdenes si aplica) | Salir

### Fase 3 — Cotización y Órdenes de Compra (hecha)
- Migraciones `0004a` (estados), `0004` (proveedores/cotizaciones/OC), `0004b` (folio + deletes)
- Estados de solicitud: `pendiente`, `cancelada`, `en_cotizacion`, `aprobada`, `rechazada`
- `/proveedores` CRUD (compras)
- Cotizar desde `/solicitudes/[id]/cotizar`
- `/ordenes` lista + detalle con folio y total calculado en servidor
- Personal **no** ve precios ni OC; solo el estado de su solicitud
- Auditoría en tablas con dinero

Lo que sigue (no te saltes fases — ver `.cursorrules`):
4. Recepción / checklist de materiales
5. Asignación de materiales a obra (activa el saldo real)
6. Traspasos entre obras
7. Cierre de obra y reportes de conciliación

**Transversal pendiente:** offline-first (service worker + cola) para pantallas de Personal — lo necesita también la recepción de Fase 4.

## Cómo arrancar

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` → `/login`.

### Usuarios de prueba (solo desarrollo — cambiar antes de producción)

| Correo | Contraseña | Rol |
|--------|------------|-----|
| `emilio.prueba@example.com` | `TempEmilio2026!` | `acceso_total` |
| `manuel.prueba@example.com` | `TempManuel2026!` | `proyectos` |
| `guero.prueba@example.com` | `TempGuero2026!` | `personal` |
| `talia.prueba@example.com` | `TempTalia2026!` | `compras` |

Script: [`supabase/seed_usuarios_prueba.sql`](supabase/seed_usuarios_prueba.sql).

Smoke E2E Fase 3: [`scripts/e2e-fase3.ps1`](scripts/e2e-fase3.ps1).

## Seguridad

Lee `.cursorrules` antes de tocar cualquier tabla nueva. RLS obligatorio desde el commit en que se crea la tabla. La `service_role` key NUNCA va en `app/` ni `components/`.
