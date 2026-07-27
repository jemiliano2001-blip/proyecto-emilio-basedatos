# Proyecto Emilio - Base de Datos

Sistema de trazabilidad de materiales y proyectos. Next.js 14 + Supabase (PostgreSQL).
En UI se dice **proyecto**; la tabla sigue siendo `obras`.

## Estado actual: Fase 4 + cambios Emilio (proyecto / presupuesto / requisiciones)

### Fase 0 — Infraestructura (hecha)
- Proyecto Supabase: `proyecto-emilio-basedatos` (ref `uplxxnpurpqlvhjrsufa`)
- Migraciones en repo: `0001` … `0007` (aplicar `0006`/`0006a`/`0007` en remoto **después de revisarlas**)
- `.env.local` con URL + anon key (no subir a git)
- Usuarios de prueba sembrados (ver abajo)

Pendiente operativo (dashboard, no código):
- [ ] Aplicar migraciones `0006`, `0006a`, `0007` en Supabase (revisar antes)
- [ ] Crear usuario Blanquita con rol `finanzas`
- [ ] Activar backups automáticos (Settings → Database → Backups) — requiere plan Pro
- [ ] Activar "Leaked password protection" en Auth
- [ ] Reemplazar íconos PWA placeholder por logo real de la empresa

### Fase 1 — Catálogo + Proyectos + Topes
- Login individual (`/login`) + middleware de sesión
- CRUD proyectos (labels UI) y materiales
- Campos proyecto: `cliente`, `presupuesto_mxn`, fraccionamiento, paquete (texto libre), estatus
- Topes contratados al crear proyecto + después; vista `v_saldo_material_obra`
- Catálogo por categorías fijas: Obra Civil / Electromecánico + subcategorías

### Fase 2 — Solicitudes / requisiciones de campo
- Personal crea/cancela requisiciones; Compras/Finanzas/Proyectos/Operación ven control
- Tipos de línea: material, flete, camiones, mantenimiento, otro
- Combobox de materiales con buscador; título “Solicitud para requisición de materiales”
- Offline: IndexedDB + sync

### Fase 3 — Cotización y Órdenes de Compra (legacy + puente)
- Cotización sigue disponible como flujo anterior
- Flujo feliz nuevo **no** exige cotizar: req → Compras → Finanzas → OC

### Fase 4 — Recepción / checklist (hecha)
- Migraciones `0005a` + `0005` (+ `0005b` race/fecha)
- Personal captura; Talía (`compras`) revisa
- Offline: service worker + IndexedDB + sync APIs

### Cambios Emilio — presupuesto dual + aprobación Compras → Finanzas
- Migraciones: `0006` (cliente, presupuesto MXN, categorías, movimientos), `0006a` (rol `finanzas` + estados), `0007` (reservas, RPCs, OC desde req)
- Estados req: `recibida` → `en_proceso` → `finalizada` (+ `rechazada` / `cancelada`)
- RPCs: `aprobar_solicitud_compras`, `aprobar_pago_solicitud`, `rechazar_solicitud`, `cancelar_solicitud`
- Saldo cantidad (comprometido/usado) + saldo monetario (`v_saldo_presupuesto_obra`)
- Bandejas en `/solicitudes` por rol

Lo que sigue (no te saltes fases — ver `.cursorrules`):
5. Asignación de materiales a obra (refinar saldo real vs reservas)
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
| *(crear)* Blanquita | — | `finanzas` |

Script: [`supabase/seed_usuarios_prueba.sql`](supabase/seed_usuarios_prueba.sql).

Smoke E2E:
- Fase 3: [`scripts/e2e-fase3.ps1`](scripts/e2e-fase3.ps1)
- Fase 4: [`scripts/e2e-fase4.ps1`](scripts/e2e-fase4.ps1)

## Seguridad

Lee `.cursorrules` antes de tocar cualquier tabla nueva. RLS obligatorio desde el commit en que se crea la tabla. La `service_role` key NUNCA debe ir en `app/` ni `components/`.

Cambios de estado de requisición y descuentos de presupuesto van por RPC (`security definer`) con validación de `usuarios.rol` vía `auth_rol()`. Las vistas de recepción son internas; el cliente usa RPCs `listar_*`, `detalle_*`, `crear_recepcion`, `revisar_recepcion`.
