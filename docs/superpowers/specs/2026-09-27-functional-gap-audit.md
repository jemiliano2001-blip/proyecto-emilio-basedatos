# Functional gap audit + consistencia — ObraTrack

Fecha: 2026-09-27
Modo: auditoría de solo lectura (7 agentes: 6 Sonnet, 1 Haiku) + verificación manual de los
hallazgos altos. No se tocó Supabase ni se corrieron los E2E.

## Línea base

- `npx tsc --noEmit` → limpio · `npm run lint` → limpio · `npm test` → **50/50** (PGlite local).
- De los 33 hallazgos de la auditoría del 2026-09-14, la mayoría quedaron **corregidos**
  (#1–#6, #8, #9, #11–#15, #19, #21–#26, #28–#30, #33). Siguen abiertos: **#7 (reabierto por otra vía)**,
  **#16**, **#20**, **#32**; parciales: #10, #31.
- Categorías auditadas: controles desconectados, estados vacío/carga/error, validación inconsistente.

## Prioridad 1 — alto severidad, alta confianza

| # | Hallazgo | Dónde | Tipo de fix |
|---|-----------|-------|-------------|
| P1-1 | **OC emitida sin proveedor queda irrecibible** (checklist da 404). El select de proveedor en la aprobación de Compras permite "Por definir"; `aprobar_pago_solicitud` inserta la OC con `proveedor_id` null; `detalle_orden_checklist` hace INNER JOIN a proveedores. Reabre #7. | `components/AprobarRequisicion.tsx:159`, `0027:310-328`, `0005:281` | Decisión: exigir proveedor al aprobar (código) y/o LEFT JOIN (migración) |
| P1-2 | **`v_conciliacion_obra_material` se borra por CASCADE en 0020 y nadie la recrea.** La conciliación muestra la tabla de materiales vacía en silencio (la página no revisa el error). | `0020:17`, `app/obras/[id]/conciliacion/page.tsx:56` | Migración (recrear vista) + capturar error en página |
| P1-3 | **Cerrar proyecto no congela topes:** editar cantidad, borrar un material o borrar todos no revisan `obras.estado` (ni la action ni la policy). | `lib/actions/topes.ts:66,129,161`, `0001:167`, `0020:13` | Código (chequeo en action + ocultar UI) y migración (trigger) |
| P1-4 | **Borrar el tope de un material con compras lo desaparece** del detalle, conciliación y Excel (la vista arma su universo desde `obra_material_contratado`). | `0020:21-35`, `components/ObraMaterialesList.tsx:505-606` | Decisión de negocio |
| P1-5 | **Personal recibe `precio_base`** en el payload de `/materiales` (oculto solo visualmente) y, más de fondo, `catalogo_select` deja a cualquier autenticado leer la columna vía PostgREST. | `app/materiales/page.tsx:21-28`, `0001:144` | Código (quitar del select) + migración (permiso de columna/vista) |
| P1-6 | **Editar correo de usuario puede quedar a medias:** se cambia en Auth antes de validar "último admin" y antes del UPDATE de `usuarios`; si falla después, no se revierte. | `lib/actions/usuarios.ts:175-232` | Código |
| P1-7 | **El QR impreso en la OC no es un QR válido** (sin Reed-Solomon ni formato ISO 18004); `BarcodeDetector` no lo puede leer. El test solo valida la geometría. | `lib/qr.ts:75-103`, `OrdenCompraFormatoImpresion.tsx:271` | Encoder real o librería (dependencia nueva → preguntar) |
| P1-8 | **Renglones no-material (flete, camiones…) salen como "Material"** en el detalle de OC, WhatsApp, Excel y el ligado de facturas (el select no trae `descripcion`/`tipo_linea`; `formato/page.tsx` sí lo hace bien). | `app/ordenes/[id]/page.tsx:73-80,211-288` | Código |
| P1-9 | **`ordenes_compra` sin trigger `before update`** de máquina de estados (un PATCH directo puede pasar `emitida`→`completada` o cambiar `total`). | `0004:164`, `0014:63` | Migración |
| P1-10 | **Finanzas ve "Recepción" en el nav pero las RPC la rechazan**; el error se ve como "Sin recepciones". | `lib/roles.ts:72`, `lib/nav.ts:107`, `0005:634`, `0019:99`, `app/recepciones/page.tsx:54` | Decisión (¿Finanzas ve recepciones?) + capturar error |
| P1-11 | **Inventario de campo ignora traspasos:** lo que entra por traspaso no se puede reportar como instalado; lo que sale sigue como pendiente. | `0023:46-58` | Migración + decisión |

## Prioridad 2 — medio, o alto con confianza media

- **Presupuesto sin piso**: `editar_proyecto` permite bajar `presupuesto_mxn` por debajo de lo gastado/comprometido (`0016:34-37`). *[alto, confianza media — migración]*
- **Tope sin piso**: `validateTopeInput` solo exige ≥0; el badge no distingue negativo de cero (`lib/validations/tope.ts`, `ObraMaterialesList.tsx:402-408`).
- **Asignar materiales en proyecto cerrado**: sin redirect ni link oculto; error genérico al final (`app/obras/[id]/asignar-materiales/page.tsx`, `app/obras/[id]/page.tsx:204-212`).
- **Borrador de OC ($0, "A DETERMINAR") con WhatsApp y Excel habilitados** (`app/solicitudes/[id]/formato/page.tsx:71-84`).
- **Drawer de Abastecimiento**: badges topados en 20 y errores → "No hay pendientes" (`app/api/abastecimiento/pendientes/route.ts:24-71`).
- **Compras no puede editar/quitar renglones de servicio** al aprobar (`app/solicitudes/[id]/page.tsx:178-195`).
- **Factura mayor que el total de la OC** sin aviso (`lib/actions/ordenes.ts:55-179`).
- **Selector de proveedor de OC incluye inactivos** (`app/ordenes/[id]/page.tsx:123-130`).
- **"Registrar otra recepción" visible a roles sin captura** — #20 sigue abierto (`app/recepciones/[id]/page.tsx:184-191`).
- **`OfflineRecordEditor` no recalcula `estado`** al corregir cantidades (`components/OfflineRecordEditor.tsx:17-25`).
- **Evidencia fotográfica que falla al guardarse se traga** (`lib/actions/recepciones.ts:168-246`).
- **Reportar instalación sin cola offline** (ya avisa; falta la cola) — regla offline de Personal.
- **Rate limit de login en memoria** — no confiable en serverless (`lib/rate-limit.ts:5`).
- **Renombrar categoría no atómico** (`lib/actions/categorias.ts:60-84`).
- **Editar kit con componente inactivo** — select sin opción válida (`app/kits/[id]/editar/page.tsx:48`). *[confianza media]*

## Prioridad 3 — bajo / posiblemente deliberado

- `/inventario/[obraId]`: error de consulta de obra → 404 (`page.tsx:39-45`).
- Vista guardada con categoría inexistente → catálogo en blanco — #16 (`CatalogoMaterialesView.tsx:150`).
- Middleware sin envs se salta auth (`middleware.ts:16-18`) — sin envs tampoco cargan datos; conviene fail-closed.
- Excel de OC: error tragado (`BotonDescargarOrdenExcel.tsx:28-32`).
- Aprobación en lote sin proveedor por partida (coherente con su `confirm()`; posiblemente deliberado).
- Checklist de OC cancelada se deja llenar hasta el final (`0005:230-260`).
- Botón de recepción sin "pending" en rama offline (trivial).
- `MatrizPermisosRoles` es guía estática escrita a mano (puede divergir de `lib/roles.ts`) y usa colores crudos.
- Táctiles <44px en `ObraMaterialesList` — #32.
- `CotizarForm` / `AprobarRechazarCotizacion` son código muerto (ya no alcanzables).

## Consistencia de código / docs

- `CLAUDE.md` desfasado: dice Next 14 (es 15.5), "no hay framework de pruebas" (hay `node --test` + PGlite, 50 tests),
  migraciones `0001…0008` (hay hasta `0027`), fases 6/7 "NO aplicadas" (README: aplicadas), Inter (es Playfair + Poppins).
- Colores crudos de Tailwind (amber/stone/emerald/teal/blue…) en ~12 componentes (`AppSidebar`, `TopBar`,
  `CommandPalette`, `MatrizPermisosRoles`, `components/ui/*`), contra la regla de `design.md`.

## Estado tras la implementación (rama `cursor/functional-gap-fixes`, sin commit)

Decisiones de Emiliano: obligar proveedor al aprobar; precios fuera del payload + migración;
Finanzas SÍ ve recepciones; escribir las 4 migraciones de integridad.

**Código (aplicado, tsc/lint/50 tests en verde):** P1-1 (proveedor obligatorio en aprobación
individual y en lote), P1-2 (error visible + export oculto si falta la vista), P1-3 (candado de
cierre en las 5 actions de topes + UI oculta + redirect en asignar), P1-5 parcial (precio fuera
del payload en `/materiales` y `/solicitudes/nueva`), P1-6 (correo en Auth después de validar y
con reversión), P1-8 (descripción de renglones no-material), P1-10 parcial (error visible en
`/recepciones`), selector de proveedores activos, borrador sin WhatsApp/Excel, aviso de factura
mayor a la OC, drawer con conteo real y error, #20, `OfflineRecordEditor` recalcula estado, error
de Excel visible, `/inventario/[obraId]` error ≠ 404, #16, kit con componente inactivo,
middleware fail-closed, #32.

**Migraciones aplicadas en remoto `uplxxnpurpqlvhjrsufa` el 2026-09-27** con autorización de
Emiliano (probadas antes en PGlite sobre la cadena 0001→0032, con pruebas de comportamiento de
los triggers y de `revisar_recepcion`):
`0028` recrea conciliación · `0029` candado de cierre + piso de presupuesto ·
`0030` máquina de estados de OC · `0031` inventario con traspasos · `0032` Finanzas ve recepciones ·
`0033` quita EXECUTE público a las funciones de trigger nuevas (Security Advisor).

Hallazgos al revisar el remoto antes de aplicar:
- P1-2 **no ocurría en producción**: `v_conciliacion_obra_material` existía (idéntica a 0013).
  El bug es real solo en el historial del repo (una base nueva desde 0001 la pierde); 0028 lo corrige.
- **0019 nunca se aplicó en remoto** (no existe `recepcion_fotos`): las fotos con metadatos/GPS de
  recepción no se guardan (el catch en `lib/actions/recepciones.ts` lo oculta). Por eso 0032 parcha
  la definición viva en vez de copiar la de 0019. Si se aplica 0019 después, re-correr 0032.
- Verificado tras aplicar: 3 triggers activos, 0 OCs con estado incoherente respecto a sus
  recepciones, RPC de recepciones con `finanzas` y sin referencias a `recepcion_fotos`.

**Pendiente / requiere decisión:**
- P1-5 a nivel base: ocultar `precio_base` a Personal no es un permiso de columna (todos los roles
  de la app son el mismo rol `authenticated` de Postgres). Requiere mover las lecturas de precio a
  una vista/RPC que filtre por `auth_rol()` y cambiar ~20 archivos. Es un proyecto aparte.
- P1-4 (borrar material con compras lo oculta de reportes) — decisión de negocio.
- P1-7 (QR inválido) — requiere librería nueva o encoder propio.
- OCs de renglones de servicio (flete, etc.) siguen naciendo sin proveedor (Compras no asigna
  proveedor a servicios); no aparecen en recepción. Decidir si se les asigna proveedor.
- Tope sin piso, renglones de servicio editables por Compras, evidencia fotográfica que falla en
  silencio, cola offline de instalaciones, rate limit en memoria, rename de categoría atómico.

## Verificado que funciona (muestra)

- Corrección del "falso saldo insuficiente" (0027): sin doble descuento ni sobre-reserva.
- Permisos UI ↔ RPC alineados en solicitudes y traspasos; origen≠destino en 3 capas; cierre bloquea con traspasos en tránsito.
- Offline: idempotencia por UUID con manejo de carrera, cola aislada por usuario, 401/409 sin pérdida ni bucle; SW no cachea HTML privado.
- Protección de "último acceso_total" en código y trigger; guards de `/usuarios` y `/bitacora` = predicados del nav.
- Kits: creación/edición atómicas vía RPC (0025); validación de categoría por trigger.
