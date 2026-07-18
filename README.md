# Proyecto Emilio - Base de Datos

Sistema de trazabilidad de materiales y obras. Next.js 14 + Supabase (PostgreSQL).

## Estado actual: Fase 4 completa (Recepción / checklist offline)

### Fase 0 — Infraestructura (hecha)
- Proyecto Supabase: `proyecto-emilio-basedatos` (ref `uplxxnpurpqlvhjrsufa`)
- Migraciones aplicadas: `0001` … `0005` (+ RPCs de recepción)
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
- Personal crea/cancela solicitudes; Compras/Proyectos/Operación las ven todas
- Offline: si no hay señal, la solicitud se guarda en IndexedDB y se sincroniza después

### Fase 3 — Cotización y Órdenes de Compra (cerrada)
- `/proveedores`, cotizar desde solicitud, `/ordenes` con folio y total
- Personal **no** ve precios ni filas de `ordenes_compra`

### Fase 4 — Recepción / checklist (hecha)
- Migraciones `0005a` (estados OC) + `0005` (recepciones, RLS, auditoría, RPCs)
- Estados OC: `emitida` → `parcialmente_recibida` → `recibida` (solo con recepciones **aprobadas**)
- Personal captura checklist en `/ordenes/[id]/recibir` (cantidades, sin precios)
- Talía (`compras`) revisa en `/recepciones/[id]/revisar`
- Parciales, faltantes y dañado (observación obligatoria; sin fotos en v1)
- RPCs atómicas: `crear_recepcion` (idempotente por UUID) y `revisar_recepcion`
- Offline: service worker + IndexedDB + `/api/recepciones/sync` y `/api/solicitudes/sync`
- DELETE de OC `emitida` bloqueado si ya hay recepciones

Lo que sigue (no te saltes fases — ver `.cursorrules`):
5. Asignación de materiales a obra (activa el saldo real)
6. Traspasos entre obras
7. Cierre de obra y reportes de conciliación

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

Smoke E2E:
- Fase 3: [`scripts/e2e-fase3.ps1`](scripts/e2e-fase3.ps1)
- Fase 4: [`scripts/e2e-fase4.ps1`](scripts/e2e-fase4.ps1)

## Seguridad

Lee `.cursorrules` antes de tocar cualquier tabla nueva. RLS obligatorio desde el commit en que se crea la tabla. La `service_role` key NUNCA debe ir en `app/` ni `components/`.

Las vistas de recepción son internas (security definer); el cliente usa RPCs (`listar_*`, `detalle_*`, `crear_recepcion`, `revisar_recepcion`) que validan `usuarios.rol` vía `auth_rol()`.
