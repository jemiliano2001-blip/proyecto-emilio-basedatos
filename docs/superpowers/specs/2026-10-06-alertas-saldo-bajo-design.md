# Alertas de saldo bajo — diseño

Fecha: 2026-10-06
Estado: **0045 aplicada en remoto el 2026-10-06; 0046 (pg_cron) escrita y pendiente de autorización**
Ruta: arquitectónica (subsistema nuevo: regla de negocio en la base + programación periódica)

## 1. Objetivo y criterio de éxito

Que quien administra compras, dinero y proyectos se entere de que un proyecto se está quedando sin
**material** o sin **presupuesto** *antes* de que una requisición falle, mediante un aviso en la
campanita que lleve al proyecto.

Éxito = todo lo siguiente, comprobable:

1. Al llegar un material al **80 %** de su tope en un proyecto activo, y de nuevo al **100 %**, se
   genera un aviso para los roles definidos en §5. Igual para el presupuesto en dinero.
2. **Una sola vez por cruce**: correr la revisión repetidamente no duplica avisos.
3. Si el saldo se recupera (baja 5 puntos por debajo del umbral), la alerta se re-arma y un nuevo cruce
   vuelve a avisar.
4. Personal no recibe nada. El aviso de material **no contiene precios**.
5. Nadie con sesión (`anon`, `authenticated`) puede ejecutar la revisión ni leer la tabla de estado.
6. La revisión corre sola cada 15 minutos sin intervención de una persona.

### Decisiones tomadas por Emiliano (2026-10-06)

| Decisión | Elegido |
|---|---|
| Qué saldos alertan | **Ambos**: cantidad de material y presupuesto en dinero |
| Cuándo se calcula | **Revisión periódica con `pg_cron`** (no triggers por movimiento, no al abrir la app) |

### Supuestos míos (a confirmar al revisar)

- Umbrales fijos **80 % y 100 %**, iguales para todos los proyectos y materiales.
- Se usa la infraestructura actual (`notificaciones`, campanita, Realtime). No hay correo, WhatsApp ni push.
- `acceso_total` recibe copia de todo, porque hoy es el único rol con usuario que cubre a los roles vacíos.

## 2. Estado actual verificado en el remoto (2026-10-06)

- `notificaciones` (0001/0011): se dirige por `rol_destino` (broadcast al rol) o `usuario_id`; un trigger solo
  deja marcar `leida`. [hrefNotificacion](../../../lib/nav.ts) decide el enlace por `tipo`.
- Datos reales (corregido tras la primera ejecución en remoto): **1 proyecto, 7 materiales con tope y 1 requisición
  `recibida`** que pide el tope completo de 4 de ellos; 1 usuario por rol y **ninguno con rol `operacion`**.
  *La versión inicial de este documento decía «0 materiales con tope»: salía de leer `v_saldo_material_obra` como
  `postgres` sin sesión, que devuelve 0 filas por el filtro de 0035 (el mismo motivo por el que la función impersona).*
- `pg_cron` 1.6.4 está **disponible pero no instalado**.
- `v_saldo_material_obra` (0035) es `security_invoker=false` y filtra con `puede_acceder_obra()`, que exige
  `auth.uid() is not null`. **Un job de cron no tiene usuario**, así que sin tratamiento especial la vista
  devuelve 0 filas.
- `v_saldo_presupuesto_obra` es `security_invoker=true` sin filtro de usuario; una función `security definer`
  la lee sin problema (la RLS de `obra_presupuesto_movimientos` no aplica al dueño).

## 3. Modelo de datos — migración `0045_alertas_saldo.sql`

```sql
create table public.alertas_saldo (
  id             uuid primary key default gen_random_uuid(),
  obra_id        uuid not null references public.obras(id) on delete cascade,
  material_id    uuid references public.catalogo_materiales(id) on delete cascade,  -- null = presupuesto
  tipo           text not null check (tipo in ('material','presupuesto')),
  nivel          smallint not null check (nivel in (80,100)),
  uso_pct        numeric(6,2) not null,          -- uso al emitir
  emitida_en     timestamptz not null default now(),
  resuelta_en    timestamptz,
  check ((tipo = 'material') = (material_id is not null))
);
-- Una sola alerta ACTIVA por clave (obra, material|presupuesto, nivel).
create unique index alertas_saldo_activa_uidx on public.alertas_saldo
  (obra_id, coalesce(material_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo, nivel)
  where resuelta_en is null;
alter table public.alertas_saldo enable row level security;
revoke all on public.alertas_saldo from public, anon, authenticated;
```

RLS activo, **sin policies y sin permisos directos** (mismo patrón que `login_intentos`, 0040): la información
visible viaja en la notificación. No lleva trigger de auditoría porque no es una tabla financiera: es estado
técnico del sistema y cada aviso ya queda registrado en `notificaciones`.

## 4. Cálculo — `revisar_alertas_saldo()`

`public.revisar_alertas_saldo() returns integer` (número de notificaciones emitidas), `language plpgsql`,
`security definer`, `set search_path = public`.

### 4.1 Contexto de ejecución

1. Elegir un usuario `acceso_total` activo (`order by creado_en limit 1`). Si no hay ninguno, `raise notice` y
   `return 0` (no falla el job).
2. Fijar su identidad **solo dentro de la transacción**:
   `perform set_config('request.jwt.claim.sub', <id>::text, true);` — así `auth.uid()` devuelve ese usuario y
   `puede_acceder_obra()` deja pasar, y se **reutiliza la fórmula de saldo existente** en lugar de copiarla.
   *Riesgo aceptado:* depende de que `auth.uid()` lea ese setting (cierto en Supabase y en el fixture de
   pruebas); está cubierto por una prueba.

### 4.2 Qué se mide

Solo obras con `estado = 'activa'`.

- **Material** (por obra y material, desde `v_saldo_material_obra`):
  `capacidad = cantidad_asignada + traspasos_entrada − traspasos_salida`;
  `consumido = capacidad − cantidad_disponible` (= en proceso + comprado);
  `uso = consumido / capacidad × 100`, **acotado a 999** (cabe en `uso_pct`). Si `capacidad ≤ 0` y `consumido > 0`, `uso = 100`. Si ambos son 0, se omite.
- **Dinero** (por obra, desde `v_saldo_presupuesto_obra`):
  `uso = (comprometido_mxn + gastado_mxn) / presupuesto_mxn × 100`. También acotado a 999. Presupuesto 0 con uso > 0 → `uso = 100`;
  presupuesto 0 sin uso → se omite.

### 4.3 Reglas de emisión (por entidad medida)

1. `nivel_actual` = 100 si `uso ≥ 100`; 80 si `uso ≥ 80`; ninguno en otro caso.
2. Para cada nivel `n ∈ {80, 100}` con `n ≤ nivel_actual` y **sin alerta activa**: insertar la fila.
   Se **notifica solo si `n = nivel_actual`**. Si una entidad aparece ya en 100 %, se crea también la fila de 80
   en silencio y se emite **un** aviso (el de 100), no dos.
3. **Re-armado (histéresis de 5 puntos):** toda alerta activa cuyo `uso` actual sea `< nivel − 5` recibe
   `resuelta_en = now()`.
4. **Limpieza:** las alertas activas de proyectos que ya no están `activa`, o de materiales que ya no tienen
   medición, se resuelven.

Los cruces ocurren una vez por ciclo de 15 min: si un saldo salta de 70 % a 105 % entre revisiones, se emite el
aviso de 100 % y la fila de 80 % queda registrada sin aviso.

## 5. Destinatarios y texto

Una fila en `notificaciones` **por rol** (la tabla es broadcast por rol):

| Tipo de alerta | Roles destino |
|---|---|
| Material (`alerta_saldo_material`) | `compras`, `operacion`, `acceso_total` |
| Presupuesto (`alerta_saldo_presupuesto`) | `finanzas`, `operacion`, `acceso_total` |

`referencia_id = obra_id`. **Personal no recibe nada.** Un rol sin usuarios (hoy `operacion`) simplemente deja
las filas guardadas para quien lo ocupe después.

Plantillas (importes con `to_char(x,'FM$999,999,999,990.00')`, porcentajes redondeados al entero):

| Caso | Título | Mensaje |
|---|---|---|
| Material 80 | `Material al 80 % del tope` | `<Proyecto>: <Material> lleva el <uso> % de su tope (<consumido> de <capacidad> <unidad>).` |
| Material 100 | `Material en su tope` | `<Proyecto>: <Material> alcanzó o rebasó su tope (<consumido> de <capacidad> <unidad>). Para pedir más hay que ampliar el tope o traspasar.` |
| Presupuesto 80 | `Presupuesto al 80 %` | `<Proyecto>: el presupuesto lleva el <uso> % entre comprometido y gastado (<importe usado> de <presupuesto>).` |
| Presupuesto 100 | `Presupuesto agotado` | `<Proyecto>: el presupuesto alcanzó o rebasó el 100 % entre comprometido y gastado (<importe usado> de <presupuesto>).` |

Los avisos de **material nunca incluyen precios ni importes**.

## 6. Interfaz

Único cambio de código de aplicación: en [hrefNotificacion](../../../lib/nav.ts) agregar

```ts
if (tipo.startsWith('alerta_saldo_')) return `/obras/${referenciaId}`
```

No hay pantalla nueva ni historial.

## 7. Programación — migración `0046_programar_alertas_saldo.sql` (aparte)

```sql
create extension if not exists pg_cron;
select cron.schedule('alertas-saldo', '*/15 * * * *', $$select public.revisar_alertas_saldo()$$);
```

Va **separada de 0045** para que las pruebas locales (PGlite no tiene `pg_cron`) no dependan de ella y para que
Emiliano autorice la extensión (cambio de infraestructura) de forma independiente. `cron.schedule` con nombre es
idempotente. Si la migración no pudiera crear la extensión, se habilita desde el dashboard (Database →
Extensions) y se repite solo el `cron.schedule`.

**Permisos de la función:** `revoke all on function public.revisar_alertas_saldo() from public, anon,
authenticated, service_role;` — solo `postgres` (dueño y quien ejecuta el cron) puede llamarla.

## 8. Pruebas (PGlite, escritas antes del código)

Archivo `tests/alertas-saldo.test.mjs`, carga `0045` sobre el fixture de la base:

1. Material: tope 100, se compromete 79 → 0 avisos; 80 → 1 aviso (nivel 80); 100 → 1 aviso más (nivel 100).
2. **Idempotencia:** ejecutar la función dos veces seguidas no duplica avisos ni filas activas.
3. **Re-armado:** el uso baja a < 75 % → la alerta de 80 se resuelve; al volver a 80 % emite otra.
4. **Primer cruce directo a ≥ 100 %:** emite un solo aviso (el de 100) y deja la fila de 80 en silencio.
5. **Dinero:** presupuesto con gasto/compromiso al 80 % y al 100 % → avisos de presupuesto a `finanzas`,
   `operacion` y `acceso_total`.
6. **Destinatarios:** material → `compras`/`operacion`/`acceso_total` y **no** `finanzas` ni `personal`;
   dinero → `finanzas`/`operacion`/`acceso_total` y no `compras`.
7. **Sin precios:** el mensaje de material no contiene `$`.
8. Proyecto `cerrada` no genera avisos y resuelve alertas activas.
9. Sin usuario `acceso_total` → devuelve 0 sin error.
10. **Permisos:** `anon` y `authenticated` no pueden ejecutar la función ni leer/escribir `alertas_saldo`.
11. **Sin sesión:** la función devuelve avisos aun con `request.jwt.claim.sub` vacío (prueba de la impersonación).
12. Prueba unitaria (`node --test`) de `hrefNotificacion('alerta_saldo_material', id)` → `/obras/<id>`.

Compuertas: `npx tsc --noEmit`, `npm run lint`, `npm test`.

## 9. Despliegue y verificación

Orden (Emiliano autoriza cada paso):

1. Aplicar **0045** (tabla + función, sin cron). Verificar: tabla con RLS y sin acceso para `anon`/`authenticated`;
   función no ejecutable por `anon`/`authenticated`/`service_role`.
2. Prueba manual en remoto: ejecutar `select public.revisar_alertas_saldo();` como `postgres` → devuelve `0` (no hay
   topes con uso) y no falla.
3. Aplicar **0046** (extensión + job). Verificar `select * from cron.job` y, a los 15 min, `cron.job_run_details`.
4. Desplegar el cambio de `hrefNotificacion`.

**Reversión:** `select cron.unschedule('alertas-saldo');` y, si se quiere, `drop table alertas_saldo` +
`drop function revisar_alertas_saldo()`. No toca datos de negocio.

## 10. Fuera de alcance

Correo / WhatsApp / push; umbrales configurables por proyecto o material; avisos a Personal; pantalla de historial o
configuración de alertas; notificar a usuarios concretos en vez de por rol (la nota de 0011 ya anota que habría que
pasar a lecturas por usuario si un rol llega a tener dos personas).

## 11. Riesgos y puntos abiertos

- **Impersonación de `auth.uid()`** (§4.1): acotada a la transacción y cubierta por la prueba 11. Si un día
  `puede_acceder_obra()` cambia, esta función es la que se rompe; la prueba lo detecta.
- **`pg_cron` en Supabase:** cambio de infraestructura; se autoriza aparte (migración 0046).
- **Sin usuario `operacion` hoy:** esos avisos se guardan pero nadie los ve hasta que exista.
- **Latencia ≤ 15 min** entre el movimiento y el aviso. Es aceptable para "se está acabando"; no sirve para
  bloquear una requisición en el acto (eso ya lo hace el saldo disponible al aprobar).
- **Rol compartido:** si un rol llega a tener 2+ personas, las notificaciones broadcast se marcan leídas para
  todo el rol (limitación ya documentada en 0011).
