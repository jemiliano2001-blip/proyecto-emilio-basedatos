# Alertas de saldo bajo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avisar por la campanita, una vez por cruce de 80 % y 100 %, cuando un proyecto activo agota su tope de un material o su presupuesto en dinero.

**Architecture:** Una función SQL idempotente `revisar_alertas_saldo()` (security definer, solo `postgres`) mide el uso con las vistas de saldo existentes, guarda su estado en `alertas_saldo` y escribe en `notificaciones` por rol. Un job `pg_cron` la ejecuta cada 15 min. La app solo agrega el enlace de la notificación.

**Tech Stack:** PostgreSQL/Supabase (plpgsql, pg_cron), PGlite + `node --test` para pruebas, TypeScript (`lib/nav.ts`).

**Spec:** [docs/superpowers/specs/2026-10-06-alertas-saldo-bajo-design.md](../specs/2026-10-06-alertas-saldo-bajo-design.md) — aprobada por Emiliano el 2026-10-06. Los ejecutores deben leerla completa; los §4 y §5 fijan fórmulas y textos.

## Global Constraints

- Umbrales **80 y 100**, fijos. Histéresis de re-armado: **5 puntos** (80 → resuelve bajo 75; 100 → bajo 95).
- Solo obras con `estado = 'activa'`. `uso` acotado a **999**.
- Destinatarios (una fila de `notificaciones` por rol): material → `compras`, `operacion`, `acceso_total`; presupuesto → `finanzas`, `operacion`, `acceso_total`. **Nunca `personal`.**
- Tipos de notificación: `alerta_saldo_material`, `alerta_saldo_presupuesto`; `referencia_id = obra_id`.
- Textos y títulos: verbatim de la spec §5. **Los avisos de material no contienen `$` ni importes.**
- `alertas_saldo`: RLS activo, sin policies, `revoke all` a `public, anon, authenticated`. La función: `revoke all ... from public, anon, authenticated, service_role`.
- La migración `0045` (tabla + función) y la `0046` (cron) son **archivos separados**; `0046` no se carga en pruebas.
- **Regla del repo:** el agente escribe las migraciones pero **no las aplica en remoto ni hace commit sin que Emiliano lo autorice en ese momento** (Task 4 lo pide explícitamente). Sin dependencias nuevas. Gates: `npx tsc --noEmit`, `npm run lint`, `npm test`.
- Cada fixture de prueba debe reflejar el remoto: usar `accessFixture()` de `tests/access-fixture.mjs` (incluye las vistas de `0035` que filtran por `puede_acceder_obra`), no `databaseFixture()`.

## Review Focus

Entradas/condiciones que la spec implica y ninguna prueba de la spec cubre; cada una tiene su prueba en la tarea indicada:

1. Material con **capacidad ≤ 0 pero con consumo** (p. ej. traspaso de salida que vacía el tope) → se trata como 100 %, no divide entre cero. *(Task 2)*
2. Un saldo con **capacidad minúscula y consumo enorme** no desborda `uso_pct` (acotado a 999). *(Task 2)*
3. **Dos proyectos activos** a la vez: las alertas son independientes (no se mezclan ni se bloquean entre sí). *(Task 2)*
4. Proyecto **cerrado y luego reabierto**: la alerta se resuelve al cerrar y vuelve a emitirse al reabrir si sigue sobre el umbral. *(Task 2)*
5. **Presupuesto en 0** con gasto: se trata como 100 %; sin gasto no emite. *(Task 3)*

Además, nombres de proyecto o material con `%`, comillas o `$` no rompen el mensaje (se cubre dentro de la prueba de textos, Task 2).

---

### Task 1: Enlace de la notificación

**Files:**
- Modify: `lib/nav.ts:254-267` (`hrefNotificacion`)
- Test: `tests/nav-notificaciones.test.mjs` (crear)

**Interfaces:**
- Consumes: `hrefNotificacion(tipo: string, referenciaId: string | null): string | null` existente.
- Produces: el mismo contrato; ahora `alerta_saldo_*` → `/obras/<id>`.

- [ ] **Step 1: Escribir la prueba que falla** — `hrefNotificacion enlaza las alertas de saldo al proyecto`: assert que `hrefNotificacion('alerta_saldo_material', ID)` y `('alerta_saldo_presupuesto', ID)` valen `` `/obras/${ID}` ``; que con `referenciaId` `null` devuelve `null`; y que los tipos viejos no cambian (`'solicitud_en_proceso'` → `/solicitudes/<id>`, `'obra_cerrada'` → `/obras/<id>`).
- [ ] **Step 2: Ejecutar** `node --import ./scripts/test-register.mjs --test tests/nav-notificaciones.test.mjs`. Esperado: FALLA solo en las dos aserciones de `alerta_saldo_*` (devuelven `null`).
- [ ] **Step 3: Implementar** en `hrefNotificacion`, antes del `return null` final, esta línea:

  ```ts
  if (tipo.startsWith('alerta_saldo_')) return `/obras/${referenciaId}`
  ```
- [ ] **Step 4: Ejecutar** la prueba (pasa) y `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — pedir confirmación a Emiliano; mensaje `feat(notificaciones): enlazar alertas de saldo al proyecto`.

---

### Task 2: Tabla, función y alertas de material (`0045`)

**Files:**
- Create: `supabase/migrations/0045_alertas_saldo.sql`
- Test: `tests/alertas-saldo.test.mjs` (crear)

**Interfaces:**
- Consumes: `v_saldo_material_obra(obra_id, material_id, nombre_base, unidad_medida, cantidad_asignada, traspasos_entrada, traspasos_salida, cantidad_disponible, …)`; `notificaciones(rol_destino, titulo, mensaje, tipo, referencia_id)`; `usuarios(id, rol, activo, creado_en)`; `obras(id, nombre, estado)`.
- Produces: tabla `public.alertas_saldo` (spec §3, DDL verbatim); función `public.revisar_alertas_saldo() returns integer` = nº de notificaciones **insertadas** (filas de `notificaciones`, no de alertas). Task 3 amplía esta misma función.

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/alertas-saldo.test.mjs`. Helpers locales del archivo: `fixture()` (accessFixture + carga de `0045` + usuario `acceso_total` activo), `nuevaObra(db, nombre, presupuesto)`, `nuevoMaterial(db, nombre, unidad)`, `conTope(db, obra, mat, cantidad)`, `comprometer(db, obra, mat, n)` (solicitud `recibida` + `solicitud_items` con `cantidad_solicitada = n`; cuenta como en proceso en la vista) y `avisos(db, tipo)` (filas de `notificaciones` por `tipo`). Pruebas, cada una con el nombre indicado:
  1. `material: 79 % no avisa, 80 % avisa nivel 80, 100 % avisa nivel 100` — tope 100; comprometer 79 → `revisar_alertas_saldo()` = 0; llevar a 80 → 3 avisos (uno por rol), título `Material al 80 % del tope`; a 100 → 3 avisos más, título `Material en su tope`.
  2. `es idempotente` — dos llamadas seguidas con el mismo saldo: la segunda devuelve 0 y no crea filas en `notificaciones` ni `alertas_saldo` activas nuevas.
  3. `se re-arma con histéresis de 5 puntos` — a 80 %, reducir el consumo a 76 % (actualizando `solicitud_items.cantidad_solicitada` de la solicitud pendiente) (alerta sigue activa, sin aviso nuevo); a 74 % (se resuelve: `resuelta_en` no nulo); volver a 80 % → avisa de nuevo.
  4. `primer cruce directo a 100 % emite un solo aviso por rol` — de 0 % a 105 %: 3 avisos nivel 100 y la fila de nivel 80 existe en `alertas_saldo` sin aviso.
  5. `destinatarios` — material: roles exactamente `{compras, operacion, acceso_total}`; ninguno `finanzas` ni `personal`.
  6. `el aviso de material no contiene precios` — `mensaje` sin `$`; con material y proyecto llamados `100% "Cable" $5` el mensaje se genera completo y sin error (caracteres especiales).
  7. `capacidad ≤ 0 con consumo cuenta como 100 %` *(Review Focus 1)* — tope 10 y traspaso de salida completado de 10, más una solicitud pendiente de 1: emite nivel 100 sin error de división.
  8. `uso gigantesco no desborda` *(Review Focus 2)* — tope 1 y comprometer 5000: emite y `alertas_saldo.uso_pct = 999.00`.
  9. `dos proyectos activos son independientes` *(Review Focus 3)* — A al 85 %, B al 10 %: avisos solo con `referencia_id` de A; luego B al 100 %: avisa B sin duplicar A.
  10. `cerrar y reabrir` *(Review Focus 4)* — con alerta activa, `update obras set estado='cerrada'` → la función la resuelve y no avisa; `estado='activa'` otra vez y sigue al 85 % → avisa de nuevo.
  11. `sin usuario acceso_total devuelve 0` — con el usuario desactivado la función devuelve 0 y no lanza error.
  12. `funciona sin sesión (como cron)` — con `request.jwt.claim.sub` vacío: (control) `select count(*) from v_saldo_material_obra` da 0 filas y aun así la función emite los avisos.
  13. `permisos` — con `set role anon` y `set role authenticated`: `select public.revisar_alertas_saldo()` falla con `permission denied`; `select * from alertas_saldo` y `insert into alertas_saldo` también.
- [ ] **Step 2: Ejecutar** `node --import ./scripts/test-register.mjs --test tests/alertas-saldo.test.mjs`. Esperado: FALLAN todas (no existe `0045_alertas_saldo.sql`).
- [ ] **Step 3: Crear `0045_alertas_saldo.sql`** con: la tabla, el índice único parcial y los `revoke` de la spec §3 (verbatim); y `revisar_alertas_saldo() returns integer` (`plpgsql security definer set search_path = public`) siguiendo la spec §4 y §5:
  - toma un usuario `acceso_total` activo (`order by creado_en limit 1`); si no hay, `raise notice` y devuelve 0;
  - fija `set_config('request.jwt.claim.sub', <id>::text, true)` (local a la transacción);
  - recorre `v_saldo_material_obra` de obras `activa` con la fórmula `uso` de §4.2 (capacidad ≤ 0 con consumo → 100; ambos 0 → omitir; acotar a 999);
  - aplica las reglas de emisión de §4.3 (nivel actual, filas por nivel, aviso solo del nivel actual, re-armado `< nivel − 5`, limpieza de obras no activas y de materiales sin medición);
  - inserta una notificación por rol destino con los textos de §5 construidos con `format('%s', …)` (no concatenar el nombre dentro de la cadena de formato);
  - termina con `revoke all on function public.revisar_alertas_saldo() from public, anon, authenticated, service_role;`
  - sin `begin/commit` si se va a aplicar con `apply_migration`; en el archivo del repo sí (patrón de `0040`–`0044`).
- [ ] **Step 4: Ejecutar** la prueba nueva (pasan las 13 de este archivo) y `npm test` completo; luego `npx tsc --noEmit` y `npm run lint`.
- [ ] **Step 5: Comprobar que las pruebas dependen del código:** repetir la ejecución con la función vaciada (copia temporal de la prueba que cargue `select 1` en vez de `0045`) y confirmar que fallan; borrar la copia.
- [ ] **Step 6: Commit** — pedir confirmación a Emiliano; mensaje `feat(alertas): tabla y revisión de saldo de material (0045, sin aplicar)`.

---

### Task 3: Alertas de presupuesto en dinero (`0045`)

**Files:**
- Modify: `supabase/migrations/0045_alertas_saldo.sql` (la función, no la tabla)
- Test: `tests/alertas-saldo.test.mjs` (agregar)

**Interfaces:**
- Consumes: `revisar_alertas_saldo()` de Task 2; `v_saldo_presupuesto_obra(obra_id, presupuesto_mxn, comprometido_mxn, gastado_mxn, …)`; helper `fixture()` y `nuevaObra()`.
- Produces: la misma función ahora también evalúa dinero; sin cambios de firma. Para sembrar dinero en las pruebas: `insert into obra_presupuesto_movimientos(obra_id, tipo, monto_mxn)` con `tipo` `'reserva'` (compromete) o `'gasto'` (gasta); `monto_mxn > 0`.

- [ ] **Step 1: Escribir las pruebas que fallan** (agregar al archivo):
  1. `presupuesto: 80 % y 100 % avisan a finanzas, operacion y acceso_total` — presupuesto 10 000, reservar 8 000 → 3 avisos `alerta_saldo_presupuesto` título `Presupuesto al 80 %`; sumar gasto hasta 10 000 → 3 avisos más, título `Presupuesto agotado`. Los roles son exactamente `{finanzas, operacion, acceso_total}`; no `compras` ni `personal`.
  2. `el aviso de presupuesto trae importes en MXN` — el mensaje contiene `$8,000.00` y `$10,000.00` (formato `FM$999,999,999,990.00`).
  3. `presupuesto 0 con gasto cuenta como 100 %, sin gasto no emite` *(Review Focus 5)* — obra con `presupuesto_mxn = 0`: sin movimientos → 0 avisos; con una reserva de 50 → emite nivel 100 sin error de división.
  4. `material y dinero son independientes` — una misma obra puede tener alerta de material al 80 % y de dinero al 100 % a la vez, cada una con su tipo y sus roles.
- [ ] **Step 2: Ejecutar** el archivo. Esperado: FALLAN las 4 nuevas; las 13 de Task 2 siguen pasando.
- [ ] **Step 3: Ampliar `revisar_alertas_saldo()`** con la medición de §4.2 sobre `v_saldo_presupuesto_obra` (`uso = (comprometido_mxn + gastado_mxn) / presupuesto_mxn × 100`, presupuesto 0 con uso > 0 → 100, acotar a 999) reutilizando las mismas reglas de emisión y re-armado de §4.3 con `material_id = null` y `tipo = 'presupuesto'`; destinatarios y textos de §5. Si la lógica de emisión quedó duplicada entre material y dinero, extraerla a una función auxiliar interna con `revoke` igual (una sola implementación de las reglas).
- [ ] **Step 4: Ejecutar** el archivo (17 pruebas) + `npm test` + `npx tsc --noEmit` + `npm run lint`.
- [ ] **Step 5: Commit** — pedir confirmación; mensaje `feat(alertas): alertas de presupuesto en dinero (0045, sin aplicar)`.

---

### Task 4: Programación, aplicación en remoto y verificación (`0046`)

**Files:**
- Create: `supabase/migrations/0046_programar_alertas_saldo.sql`
- Modify: `CLAUDE.md` (línea de migraciones, estado de `0045`/`0046`), `README.md` solo si menciona notificaciones

**Interfaces:**
- Consumes: `public.revisar_alertas_saldo()` de Tasks 2–3.
- Produces: job `pg_cron` `alertas-saldo` cada 15 min; registro del estado en `CLAUDE.md`.

- [ ] **Step 1: Escribir `0046_programar_alertas_saldo.sql`** con `create extension if not exists pg_cron;` y `select cron.schedule('alertas-saldo', '*/15 * * * *', $$select public.revisar_alertas_saldo()$$);` (spec §7). No se carga en las pruebas.
- [ ] **Step 2: Pedir autorización explícita a Emiliano** para aplicar `0045` en `uplxxnpurpqlvhjrsufa`. Antes de aplicar, verificar con `execute_sql` de solo lectura que no existe `alertas_saldo` ni la función. Aplicar con `apply_migration` (nombre `0045_alertas_saldo`, contenido sin `begin/commit`).
- [ ] **Step 3: Verificar `0045` en remoto** (solo lectura): `alertas_saldo` con RLS activo; `has_table_privilege('anon'|'authenticated', 'public.alertas_saldo', 'select')` = false; `has_function_privilege` de `anon`, `authenticated` y `service_role` sobre `revisar_alertas_saldo()` = false; ejecutar `select public.revisar_alertas_saldo();` como `postgres` devuelve `0` y no falla (hoy no hay topes con uso). Revisar `get_advisors` de seguridad: la única novedad esperada es `rls_enabled_no_policy` INFO sobre `alertas_saldo`.
- [ ] **Step 4: Pedir autorización explícita** para la extensión `pg_cron` y aplicar `0046` (nombre `0046_programar_alertas_saldo`). Si falla al crear la extensión, pedir a Emiliano que la habilite en el dashboard (Database → Extensions) y reaplicar solo el `cron.schedule`.
- [ ] **Step 5: Verificar el job:** `select jobname, schedule, active from cron.job where jobname = 'alertas-saldo'` devuelve 1 fila activa con `*/15 * * * *`; pasados ≥ 15 min, `cron.job_run_details` muestra una ejecución `succeeded` (si aún no pasó el tiempo, decirlo y dejar la comprobación como pendiente).
- [ ] **Step 6: Documentar** en `CLAUDE.md` el nuevo rango `0001…0046` y que las alertas corren por `pg_cron`, y anotar en la spec su estado (**implementada y aplicada** con fecha).
- [ ] **Step 7: Verificación final:** `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. Esperado: todo verde.
- [ ] **Step 8: Commit** — pedir confirmación; mensaje `feat(alertas): programar la revisión cada 15 min con pg_cron (0046) y documentar`.
