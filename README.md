# Proyecto Emilio - Base de Datos

Sistema de trazabilidad de materiales y proyectos. Next.js 14 + Supabase (PostgreSQL).
En UI se dice **proyecto**; la tabla sigue siendo `obras`.

## Estado actual: Fase 7 — Cierre de obra y reportes de conciliación (hecha)

### Fase 0 — Infraestructura (hecha)
- Proyecto Supabase: `proyecto-emilio-basedatos` (ref `uplxxnpurpqlvhjrsufa`)
- Migraciones en repo: `0001` … `0011` (aplicadas en remoto, incluida `0011` de notificaciones Realtime)
- `.env.local` con URL + anon key (no subir a git)
- Usuarios de prueba sembrados (ver abajo)

Pendiente operativo (dashboard, no código):
- [x] Aplicar migraciones `0009_traspasos_obra.sql`, `0010_cierre_conciliacion_obra.sql` y `0011_notificaciones_realtime.sql` (0009 → 0010 → 0011)
- [ ] Crear usuario Blanquita con rol `finanzas` (por ahora las aprobaciones de pago las hace `acceso_total`)
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

### Fase 5 — Requisición multi-obra (hecha)
- Migración `0008`: `solicitud_items.obra_id` (renglón puede pertenecer a una obra distinta de la cabecera)
- Compras (`compras`/`acceso_total`) puede levantar una sola requisición con renglones repartidos en varias obras
- Aprobación todo-o-nada: si falta saldo (cantidad o presupuesto) en cualquier obra involucrada, no se reserva nada
- Al pagar se emite **una orden de compra por cada obra distinta** de la requisición
- Doc de diseño: [`docs/superpowers/specs/2026-08-05-fase5-requisicion-multiobra-design.md`](docs/superpowers/specs/2026-08-05-fase5-requisicion-multiobra-design.md)

### Fase 6 — Traspasos entre obras (aplicada)
- Migración `0009`: Tablas `traspasos_obra` y `traspaso_items`, secuencia de folios (`TR-00001`), actualización de vista `v_saldo_material_obra` para entradas/salidas de traspasos.
- RPCs transaccionales: `crear_solicitud_traspaso`, `aprobar_traspaso`, `confirmar_recepcion_traspaso`, `rechazar_traspaso`, `cancelar_traspaso`.
- Guardias de integridad: `fn_traspasos_obra_before_update` (máquina de estados + saldo) y `fn_traspaso_items_guard` (renglones inmutables una vez aprobado). Sin ellos, un PATCH directo a PostgREST movía material entre obras sin aprobación.
- UI en `/traspasos`, `/traspasos/nuevo` (con buscador y saldo disponible en origen en vivo), y `/traspasos/[id]` (detalle y trazabilidad).
- Script de prueba: [`scripts/e2e-fase6.ps1`](scripts/e2e-fase6.ps1)
- **El dinero sigue al material.** Al aprobar, cada renglón congela su
  `precio_unitario_mxn` con el último precio de compra del material (primero el de la
  obra origen, si no el de cualquier obra, si no $0). Al completarse, ese monto se le
  **abona a la obra origen** y se le **carga a la destino** — se calcula dentro de
  `v_saldo_presupuesto_obra` a partir de las tablas de traspaso, no con filas en
  `obra_presupuesto_movimientos` (esa tabla exige `monto > 0` y sus tipos
  reserva/gasto/liberacion no permiten devolver dinero ya gastado).
- Aprobar un traspaso **falla si la obra destino no tiene presupuesto disponible** para
  absorber el costo, igual que una requisición.

### Fase 7 — Cierre de obra y reportes de conciliación (aplicada)
- Migración `0010`: columna `obras.cierre_nota`, RPCs `cerrar_obra` y `reabrir_obra` con validación de pendientes (requisiciones, traspasos, órdenes de compra abiertas y recepciones sin revisar).
- Vistas de conciliación: `v_conciliacion_obra_presupuesto` ($ MXN y variaciones, restringida a roles que ven precios) y `v_conciliacion_obra_material` (cantidades físicas, traspasos, recepciones en sitio y remanentes).
- UI en `/obras/[id]/conciliacion` (dashboard de conciliación ejecutiva y operativa) y acciones de cierre/reapertura en la vista del proyecto.
- Script de prueba: [`scripts/e2e-fase7.ps1`](scripts/e2e-fase7.ps1)

> **Nota de revisión (2026-08-06 / aplicada 2026-08-14):** `0009`, `0010` y `0011`
> están aplicadas en el remoto `uplxxnpurpqlvhjrsufa`. El bug histórico de `0009` era un
> `create or replace view` sobre `v_saldo_material_obra` que cambiaba el orden de
> columnas; la migración lleva `drop view` explícito.


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

Smoke E2E — ⚠️ **pegan al Supabase remoto real y modifican datos** (suben topes,
cambian presupuestos, dejan traspasos completados). No los corras a ciegas.

- Fase 3: [`scripts/e2e-fase3.ps1`](scripts/e2e-fase3.ps1)
- Fase 4: [`scripts/e2e-fase4.ps1`](scripts/e2e-fase4.ps1)
- Fase 5: [`scripts/e2e-fase5.ps1`](scripts/e2e-fase5.ps1)
- Fase 6: [`scripts/e2e-fase6.ps1`](scripts/e2e-fase6.ps1) — requiere `0009` aplicada
- Fase 7: [`scripts/e2e-fase7.ps1`](scripts/e2e-fase7.ps1) — requiere `0010` aplicada

## Seguridad

Lee `.cursorrules` antes de tocar cualquier tabla nueva. RLS obligatorio desde el commit en que se crea la tabla. La `service_role` key NUNCA debe ir en `app/` ni `components/`.

Cambios de estado de requisición y descuentos de presupuesto van por RPC (`security definer`) con validación de `usuarios.rol` vía `auth_rol()`. Las vistas de recepción son internas; el cliente usa RPCs `listar_*`, `detalle_*`, `crear_recepcion`, `revisar_recepcion`.
