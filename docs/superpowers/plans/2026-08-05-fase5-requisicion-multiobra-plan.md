# Fase 5 — Requisición multi-obra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que una sola requisición (levantada por Compras) tenga renglones destinados a distintas obras, y que avance por aprobación y pago como una sola unidad ("todo o nada"), emitiendo una Orden de Compra por cada obra involucrada.

**Architecture:** Se agrega una columna `obra_id` opcional a `solicitud_items` (hereda la obra de la cabecera cuando es null, comportamiento actual sin cambios). Las 3 RPCs financieras (`aprobar_solicitud_compras`, `aprobar_pago_solicitud`, `rechazar_solicitud`) se reescriben para resolver y agrupar por obra en vez de asumir una sola. La UI agrega un modo "multi-obra" visible solo para Compras.

**Tech Stack:** Next.js 14 (App Router) + TypeScript estricto + Supabase (Postgres/PostgREST) + Tailwind. Sin frameworks de testing instalados (no Jest/Vitest/Playwright) — la verificación de SQL usa scripts PowerShell contra la API REST de Supabase (mismo patrón que `scripts/e2e-fase3.ps1` / `e2e-fase4.ps1`), y la verificación de TypeScript usa `npx tsc --noEmit` (ya configurado en `tsconfig.json`, `noEmit: true`).

## Global Constraints

- No agregar dependencias nuevas sin preguntar primero (`.cursorrules`).
- RLS obligatorio en toda tabla — aquí no se crean tablas nuevas, solo columnas/índices/constraints en tablas que ya tienen RLS activado.
- Ninguna migración se aplica en el Supabase remoto sin que Emiliano/Emilio la revisen primero — el agente que ejecute este plan **nunca** aplica la migración por su cuenta; la Tarea 2 es un punto de control manual explícito.
- No tocar tablas ni RPCs de Fase 3 (cotización legacy) ni Fase 4 (recepción/checklist) — ninguna OC generada cambia de forma, solo puede haber más de una por requisición.
- Cero regresión: una requisición de una sola obra (el caso de Personal, ~95% del uso real) debe comportarse exactamente igual que hoy en cada una de las 3 RPCs tocadas.
- Convenciones existentes: tablas/columnas en español snake_case; componentes React en PascalCase; server actions en `lib/actions/`.
- No hay framework de pruebas unitarias instalado — no se introduce uno en este plan. La verificación de TypeScript es `npx tsc --noEmit`; la verificación de SQL/RPCs es el script `scripts/e2e-fase5.ps1` corrido contra el proyecto Supabase real después de aplicar la migración (Tarea 2).

---

### Task 1: Migración `0008` — esquema y RPCs multi-obra

**Files:**
- Create: `supabase/migrations/0008_requisicion_multiobra.sql`

**Interfaces:**
- Produces: columna `solicitud_items.obra_id uuid` (nullable, FK a `obras(id)`).
- Produces: `aprobar_solicitud_compras(p_solicitud_id uuid) returns void` — firma sin cambios, cuerpo reescrito para agrupar por obra resuelta del renglón.
- Produces: `aprobar_pago_solicitud(p_solicitud_id uuid) returns uuid[]` — **cambia de `returns uuid` a `returns uuid[]`** (requiere `drop function` antes de recrear, Postgres no permite `create or replace` con tipo de retorno distinto).
- Produces: `rechazar_solicitud(p_solicitud_id uuid, p_motivo text) returns void` — firma sin cambios, cuerpo reescrito para liberar dinero por obra.

- [ ] **Step 1: Escribir la migración completa**

```sql
-- =====================================================================
-- MIGRACIÓN 0008 — Requisición multi-obra (Fase 5)
-- Permite que una requisición tenga renglones de distintas obras.
-- La cabecera (solicitudes_material.obra_id) sigue siendo obligatoria y
-- guarda la obra del primer renglón capturado, solo como referencia para
-- vistas que hoy asumen "una obra por requisición" (lista, notificaciones).
-- La obra real de cada renglón vive en solicitud_items.obra_id; cuando es
-- null, hereda la de la cabecera (comportamiento actual de Personal, sin
-- cambios).
-- =====================================================================

alter table solicitud_items
    add column if not exists obra_id uuid references obras(id);

create index if not exists idx_solicitud_items_obra on solicitud_items(obra_id);

-- Antes: unique (solicitud_id, material_id) — impedía repetir un material
-- en la misma requisición sin importar la obra. Ahora debe permitir el
-- mismo material en obras distintas, pero seguir bloqueando repetirlo en
-- la misma obra. coalesce(...) hace que los renglones con obra_id null
-- (flujo normal de Personal, todos heredan la obra de la cabecera) sigan
-- colisionando entre sí exactamente igual que hoy.
drop index if exists solicitud_items_solicitud_material_uidx;

create unique index solicitud_items_solicitud_material_obra_uidx
    on solicitud_items (
        solicitud_id,
        material_id,
        coalesce(obra_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    where material_id is not null;

-- Antes: unique (solicitud_id, material_id) en las reservas — con
-- multi-obra puede haber 2 reservas del mismo material en la misma
-- solicitud (una por obra). Aquí obra_id siempre es no-nulo (se resuelve
-- antes de insertar en las RPCs de abajo), así que no hace falta coalesce.
alter table solicitud_reservas_cantidad
    drop constraint if exists solicitud_reservas_cantidad_solicitud_id_material_id_key;

alter table solicitud_reservas_cantidad
    add constraint solicitud_reservas_cantidad_solicitud_material_obra_key
    unique (solicitud_id, material_id, obra_id);

-- Compras (Talía) ahora puede levantar requisiciones (multi-obra o no).
drop policy if exists solicitudes_material_insert on solicitudes_material;

create policy solicitudes_material_insert on solicitudes_material for insert
    with check (
        solicitante_id = auth.uid()
        and auth_rol() in ('personal', 'compras', 'acceso_total')
    );

-- =====================================================================
-- RPC: aprobar compras (Thalía) — reserva saldo, agrupado por obra
-- resuelta de cada renglón (coalesce(item.obra_id, cabecera.obra_id)).
-- Todo-o-nada: si cualquier obra involucrada no tiene saldo, la función
-- completa lanza excepción y no reserva nada (atomicidad de transacción).
-- =====================================================================
create or replace function aprobar_solicitud_compras(p_solicitud_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol rol_usuario := auth_rol();
    v_uid uuid := auth.uid();
    v_sol solicitudes_material%rowtype;
    v_item record;
    v_grupo record;
    v_disponible_mat numeric(12,2);
    v_disponible_mxn numeric(14,2);
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;
    if v_rol not in ('compras', 'acceso_total') then
        raise exception 'Solo Compras puede aprobar requisiciones.';
    end if;

    select * into v_sol from solicitudes_material where id = p_solicitud_id for update;
    if not found then
        raise exception 'La requisición no existe.';
    end if;
    if v_sol.estado <> 'recibida' then
        raise exception 'Solo se pueden aprobar requisiciones en estatus recibida.';
    end if;

    for v_item in
        select *, coalesce(obra_id, v_sol.obra_id) as obra_efectiva
        from solicitud_items
        where solicitud_id = p_solicitud_id and tipo_linea = 'material'
    loop
        select cantidad_disponible into v_disponible_mat
        from v_saldo_material_obra
        where obra_id = v_item.obra_efectiva and material_id = v_item.material_id;

        if v_disponible_mat is null then
            raise exception 'El material no tiene presupuesto de cantidad en el proyecto de uno de los renglones.';
        end if;
        if v_disponible_mat < v_item.cantidad_solicitada then
            raise exception 'Saldo de cantidad insuficiente para un material de la requisición.';
        end if;

        insert into solicitud_reservas_cantidad (
            solicitud_id, obra_id, material_id, cantidad, estado
        ) values (
            p_solicitud_id, v_item.obra_efectiva, v_item.material_id,
            v_item.cantidad_solicitada, 'activa'
        );
    end loop;

    for v_grupo in
        select
            coalesce(obra_id, v_sol.obra_id) as obra_efectiva,
            sum(monto_mxn) as monto_total
        from solicitud_items
        where solicitud_id = p_solicitud_id and tipo_linea <> 'material'
        group by coalesce(obra_id, v_sol.obra_id)
    loop
        select disponible_mxn into v_disponible_mxn
        from v_saldo_presupuesto_obra
        where obra_id = v_grupo.obra_efectiva;

        if coalesce(v_disponible_mxn, 0) < v_grupo.monto_total then
            raise exception 'Presupuesto monetario insuficiente para esta requisición.';
        end if;

        insert into obra_presupuesto_movimientos (
            obra_id, solicitud_id, tipo, monto_mxn, nota, creado_por
        ) values (
            v_grupo.obra_efectiva, p_solicitud_id, 'reserva', v_grupo.monto_total,
            'Reserva por aprobación de Compras', v_uid
        );
    end loop;

    update solicitudes_material
    set estado = 'en_proceso'
    where id = p_solicitud_id;

    insert into notificaciones (rol_destino, titulo, mensaje, tipo, referencia_id)
    values (
        'finanzas',
        'Requisición lista para pago',
        'Compras aprobó una requisición. Pendiente de pago/aprobación de Finanzas.',
        'solicitud_en_proceso',
        p_solicitud_id
    );
end;
$$;

revoke all on function public.aprobar_solicitud_compras(uuid) from public;
revoke all on function public.aprobar_solicitud_compras(uuid) from anon;
grant execute on function public.aprobar_solicitud_compras(uuid) to authenticated;

-- =====================================================================
-- RPC: aprobar pago (Blanquita) — emite UNA orden de compra POR CADA
-- obra distinta involucrada. Cambia el tipo de retorno de uuid a uuid[]
-- (por eso el drop function antes del create or replace).
-- =====================================================================
drop function if exists aprobar_pago_solicitud(uuid);

create or replace function aprobar_pago_solicitud(p_solicitud_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol rol_usuario := auth_rol();
    v_uid uuid := auth.uid();
    v_sol solicitudes_material%rowtype;
    v_item record;
    v_grupo record;
    v_orden_id uuid;
    v_folio text;
    v_ordenes uuid[] := '{}';
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;
    if v_rol not in ('finanzas', 'acceso_total') then
        raise exception 'Solo Finanzas puede aprobar el pago.';
    end if;

    select * into v_sol from solicitudes_material where id = p_solicitud_id for update;
    if not found then
        raise exception 'La requisición no existe.';
    end if;
    if v_sol.estado <> 'en_proceso' then
        raise exception 'Solo se pueden pagar requisiciones en proceso.';
    end if;

    for v_grupo in
        select
            coalesce(obra_id, v_sol.obra_id) as obra_efectiva,
            sum(monto_mxn) filter (where tipo_linea <> 'material') as monto_no_material,
            sum(monto_mxn) as monto_total
        from solicitud_items
        where solicitud_id = p_solicitud_id
        group by coalesce(obra_id, v_sol.obra_id)
    loop
        if coalesce(v_grupo.monto_no_material, 0) > 0 then
            insert into obra_presupuesto_movimientos (
                obra_id, solicitud_id, tipo, monto_mxn, nota, creado_por
            ) values (
                v_grupo.obra_efectiva, p_solicitud_id, 'liberacion', v_grupo.monto_no_material,
                'Libera reserva al pagar', v_uid
            );
            insert into obra_presupuesto_movimientos (
                obra_id, solicitud_id, tipo, monto_mxn, nota, creado_por
            ) values (
                v_grupo.obra_efectiva, p_solicitud_id, 'gasto', v_grupo.monto_no_material,
                'Gasto al pagar requisición', v_uid
            );
        end if;

        v_folio := next_folio_orden_compra();
        insert into ordenes_compra (
            folio, cotizacion_id, proveedor_id, obra_id, solicitud_id,
            estado, total, moneda, creado_por
        ) values (
            v_folio, null, null, v_grupo.obra_efectiva, p_solicitud_id,
            'emitida', coalesce(v_grupo.monto_total, 0), 'MXN', v_uid
        )
        returning id into v_orden_id;

        v_ordenes := array_append(v_ordenes, v_orden_id);

        for v_item in
            select *, coalesce(obra_id, v_sol.obra_id) as obra_efectiva
            from solicitud_items
            where solicitud_id = p_solicitud_id
              and coalesce(obra_id, v_sol.obra_id) = v_grupo.obra_efectiva
        loop
            if v_item.tipo_linea = 'material' then
                insert into orden_compra_items (
                    orden_id, material_id, cantidad, precio_unitario, subtotal,
                    descripcion, tipo_linea
                ) values (
                    v_orden_id,
                    v_item.material_id,
                    v_item.cantidad_solicitada,
                    case
                        when coalesce(v_item.monto_mxn, 0) > 0
                             and v_item.cantidad_solicitada > 0
                        then round(v_item.monto_mxn / v_item.cantidad_solicitada, 2)
                        else 0
                    end,
                    coalesce(v_item.monto_mxn, 0),
                    null,
                    'material'
                );
            else
                insert into orden_compra_items (
                    orden_id, material_id, cantidad, precio_unitario, subtotal,
                    descripcion, tipo_linea
                ) values (
                    v_orden_id,
                    null,
                    1,
                    v_item.monto_mxn,
                    v_item.monto_mxn,
                    v_item.descripcion,
                    v_item.tipo_linea
                );
            end if;
        end loop;
    end loop;

    update solicitud_reservas_cantidad
    set estado = 'aplicada'
    where solicitud_id = p_solicitud_id and estado = 'activa';

    update solicitudes_material
    set estado = 'finalizada'
    where id = p_solicitud_id;

    insert into notificaciones (usuario_id, titulo, mensaje, tipo, referencia_id)
    values (
        v_sol.solicitante_id,
        'Requisición pagada',
        case
            when array_length(v_ordenes, 1) > 1
            then 'Finanzas aprobó el pago. Se generaron ' || array_length(v_ordenes, 1) || ' órdenes de compra.'
            else 'Finanzas aprobó el pago.'
        end,
        'solicitud_finalizada',
        p_solicitud_id
    );

    return v_ordenes;
end;
$$;

revoke all on function public.aprobar_pago_solicitud(uuid) from public;
revoke all on function public.aprobar_pago_solicitud(uuid) from anon;
grant execute on function public.aprobar_pago_solicitud(uuid) to authenticated;

-- =====================================================================
-- RPC: rechazar — corrección de bug real, no solo adaptación. Antes
-- liberaba el dinero como UN monto acreditado a la obra de la cabecera;
-- con multi-obra eso acreditaría mal el dinero de una obra a otra. Ahora
-- libera el monto pendiente de CADA obra a su propio obra_id.
-- =====================================================================
create or replace function rechazar_solicitud(p_solicitud_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol rol_usuario := auth_rol();
    v_uid uuid := auth.uid();
    v_sol solicitudes_material%rowtype;
    v_grupo record;
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;

    select * into v_sol from solicitudes_material where id = p_solicitud_id for update;
    if not found then
        raise exception 'La requisición no existe.';
    end if;

    if v_sol.estado = 'recibida' and v_rol in ('compras', 'acceso_total') then
        null;
    elsif v_sol.estado = 'en_proceso' and v_rol in ('finanzas', 'compras', 'acceso_total') then
        update solicitud_reservas_cantidad
        set estado = 'liberada'
        where solicitud_id = p_solicitud_id and estado = 'activa';

        for v_grupo in
            select
                obra_id,
                coalesce(sum(monto_mxn) filter (where tipo = 'reserva'), 0)
                    - coalesce(sum(monto_mxn) filter (where tipo = 'liberacion'), 0) as monto_pendiente
            from obra_presupuesto_movimientos
            where solicitud_id = p_solicitud_id
            group by obra_id
        loop
            if v_grupo.monto_pendiente > 0 then
                insert into obra_presupuesto_movimientos (
                    obra_id, solicitud_id, tipo, monto_mxn, nota, creado_por
                ) values (
                    v_grupo.obra_id, p_solicitud_id, 'liberacion', v_grupo.monto_pendiente,
                    coalesce(p_motivo, 'Rechazo — libera reserva'), v_uid
                );
            end if;
        end loop;
    else
        raise exception 'No puedes rechazar esta requisición en su estatus actual.';
    end if;

    update solicitudes_material
    set estado = 'rechazada',
        nota = case
            when p_motivo is null or length(trim(p_motivo)) = 0 then nota
            when nota is null then 'Rechazo: ' || trim(p_motivo)
            else nota || E'\nRechazo: ' || trim(p_motivo)
        end
    where id = p_solicitud_id;

    insert into notificaciones (usuario_id, titulo, mensaje, tipo, referencia_id)
    values (
        v_sol.solicitante_id,
        'Requisición rechazada',
        coalesce(p_motivo, 'Tu requisición fue rechazada.'),
        'solicitud_rechazada',
        p_solicitud_id
    );
end;
$$;

revoke all on function public.rechazar_solicitud(uuid, text) from public;
revoke all on function public.rechazar_solicitud(uuid, text) from anon;
grant execute on function public.rechazar_solicitud(uuid, text) to authenticated;
```

- [ ] **Step 2: Revisión manual del archivo (no hay Postgres local para correrlo)**

Releer el archivo completo verificando: cada `$$ ... $$` tiene su `begin`/`end;` balanceado, cada `create or replace function` tiene su bloque `revoke`/`grant` correspondiente, y el `drop function if exists aprobar_pago_solicitud(uuid);` está **antes** de su `create or replace function` (Postgres rechaza cambiar el tipo de retorno con `create or replace` directo). Expected: sin desbalances de paréntesis/bloques.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_requisicion_multiobra.sql
git commit -m "feat(db): requisición multi-obra — esquema y RPCs (Fase 5)"
```

---

### Task 2: Aplicar migración `0008` en Supabase remoto (punto de control manual)

**Files:** ninguno (no hay cambio de código en el repo en esta tarea).

**Interfaces:**
- Consumes: `supabase/migrations/0008_requisicion_multiobra.sql` (Task 1).
- Produces: estado de la base remota con la migración aplicada — condición previa de las Tareas 3-11.

- [ ] **Step 1: Revisión humana**

Emiliano y/o Emilio revisan el SQL de `0008_requisicion_multiobra.sql` con el mismo criterio de siempre (RLS, corrección financiera) antes de aplicarlo. **El agente que ejecute este plan no aplica la migración por su cuenta** — esto es una acción manual, igual que con `0006`/`0006a`/`0007`.

- [ ] **Step 2: Aplicar manualmente**

Pegar y correr el contenido de `0008_requisicion_multiobra.sql` en el SQL Editor del proyecto Supabase `proyecto-emilio-basedatos` (ref `uplxxnpurpqlvhjrsufa`).

- [ ] **Step 3: Verificar que se aplicó**

Correr en el mismo SQL Editor:

```sql
select column_name from information_schema.columns
where table_name = 'solicitud_items' and column_name = 'obra_id';
```

Expected: 1 fila (`obra_id`).

```sql
select prorettype::regtype from pg_proc where proname = 'aprobar_pago_solicitud';
```

Expected: `uuid[]` (no `uuid`).

```sql
select conname from pg_constraint
where conrelid = 'solicitud_reservas_cantidad'::regclass and contype = 'u';
```

Expected: **una sola fila**, `solicitud_reservas_cantidad_solicitud_material_obra_key` (la nueva). Si aparecen 2 filas (la vieja `..._solicitud_id_material_id_key` sigue viva junto a la nueva), significa que el `drop constraint if exists` de la Task 1 no acertó el nombre autogenerado por Postgres y el constraint viejo de 2 columnas sigue bloqueando reservas del mismo material en 2 obras distintas — hay que borrarlo a mano con el nombre real que devuelva esta consulta antes de seguir a la Task 3.

No hay commit en esta tarea (no se tocó el repo).

---

### Task 3: `scripts/e2e-fase5.ps1` — escenario feliz multi-obra

**Files:**
- Create: `scripts/e2e-fase5.ps1`

**Interfaces:**
- Consumes: RPCs `aprobar_solicitud_compras`, `aprobar_pago_solicitud` ya aplicadas en remoto (Task 2); usuarios de prueba `emilio.prueba@example.com` / `talia.prueba@example.com` (ver `README.md`).
- Produces: script ejecutable que sirve de base para la Task 4 (se extiende, no se reemplaza).

- [ ] **Step 1: Escribir el script (precondiciones + escenario 1)**

```powershell
$ErrorActionPreference = 'Stop'
$envLines = Get-Content .env.local
$anon = ($envLines | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$' }).Substring('NEXT_PUBLIC_SUPABASE_ANON_KEY='.Length)
$url = ($envLines | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_URL=(.+)$' }).Substring('NEXT_PUBLIC_SUPABASE_URL='.Length)

function Get-Token([string]$email, [string]$pass) {
  $body = @{ email = $email; password = $pass } | ConvertTo-Json
  return Invoke-RestMethod -Uri "$url/auth/v1/token?grant_type=password" -Method POST -Headers @{ apikey = $anon; 'Content-Type' = 'application/json' } -Body $body
}

function Get-Headers([string]$token) {
  return @{
    apikey = $anon
    Authorization = "Bearer $token"
    'Content-Type' = 'application/json'
    Prefer = 'return=representation'
  }
}

$emilio = Get-Token 'emilio.prueba@example.com' 'TempEmilio2026!'
$talia = Get-Token 'talia.prueba@example.com' 'TempTalia2026!'
$eh = Get-Headers $emilio.access_token
$th = Get-Headers $talia.access_token

# --- Precondiciones: 2 obras activas + 1 material con saldo suficiente en ambas ---
$obras = Invoke-RestMethod -Uri "$url/rest/v1/obras?estado=eq.activa&select=id,nombre&limit=2" -Headers $eh
if (@($obras).Count -lt 2) {
  throw 'Se necesitan al menos 2 obras activas en este proyecto de Supabase para correr e2e-fase5.'
}
$obraA = $obras[0].id
$obraB = $obras[1].id
$matId = (Invoke-RestMethod -Uri "$url/rest/v1/catalogo_materiales?activo=eq.true&select=id&limit=1" -Headers $eh)[0].id

$topeHeaders = $eh.Clone()
$topeHeaders['Prefer'] = 'resolution=merge-duplicates,return=representation'
foreach ($obraId in @($obraA, $obraB)) {
  $topeBody = @{ obra_id = $obraId; material_id = $matId; cantidad_contratada = 100000 } | ConvertTo-Json
  Invoke-RestMethod -Uri "$url/rest/v1/obra_material_contratado?on_conflict=obra_id,material_id" -Method POST -Headers $topeHeaders -Body $topeBody | Out-Null
  Invoke-RestMethod -Uri "$url/rest/v1/obras?id=eq.$obraId" -Method PATCH -Headers $eh -Body '{"presupuesto_mxn":1000000}' | Out-Null
}
Write-Output "obraA=$obraA obraB=$obraB material=$matId"

# --- Escenario 1: requisición multi-obra, ambas obras con saldo suficiente ---
$solBody = @{ obra_id = $obraA; solicitante_id = $talia.user.id; nota = 'E2E Fase5 multi-obra' } | ConvertTo-Json
$sol = (Invoke-RestMethod -Uri "$url/rest/v1/solicitudes_material" -Method POST -Headers $th -Body $solBody)[0]

$itemsBody = @(
  @{ solicitud_id = $sol.id; obra_id = $obraA; tipo_linea = 'material'; material_id = $matId; cantidad_solicitada = 200 }
  @{ solicitud_id = $sol.id; obra_id = $obraB; tipo_linea = 'material'; material_id = $matId; cantidad_solicitada = 300 }
  @{ solicitud_id = $sol.id; obra_id = $obraA; tipo_linea = 'flete'; descripcion = 'Flete obra A'; monto_mxn = 500 }
  @{ solicitud_id = $sol.id; obra_id = $obraB; tipo_linea = 'flete'; descripcion = 'Flete obra B'; monto_mxn = 700 }
) | ConvertTo-Json
Invoke-RestMethod -Uri "$url/rest/v1/solicitud_items" -Method POST -Headers $th -Body $itemsBody | Out-Null
Write-Output "solicitud_multiobra=$($sol.id)"

Invoke-RestMethod -Uri "$url/rest/v1/rpc/aprobar_solicitud_compras" -Method POST -Headers $th -Body (@{ p_solicitud_id = $sol.id } | ConvertTo-Json) | Out-Null
Write-Output 'OK aprobar_solicitud_compras (multi-obra)'

$ordenes = Invoke-RestMethod -Uri "$url/rest/v1/rpc/aprobar_pago_solicitud" -Method POST -Headers $th -Body (@{ p_solicitud_id = $sol.id } | ConvertTo-Json)
if (@($ordenes).Count -ne 2) {
  throw "FAIL: se esperaban 2 ordenes de compra, salieron $(@($ordenes).Count)"
}
Write-Output "OK 2 ordenes generadas: $($ordenes -join ', ')"

$ocA = Invoke-RestMethod -Uri "$url/rest/v1/ordenes_compra?id=in.($($ordenes -join ','))&obra_id=eq.$obraA&select=id,total" -Headers $th
$ocB = Invoke-RestMethod -Uri "$url/rest/v1/ordenes_compra?id=in.($($ordenes -join ','))&obra_id=eq.$obraB&select=id,total" -Headers $th
if (@($ocA).Count -ne 1 -or @($ocB).Count -ne 1) {
  throw 'FAIL: cada obra debe tener exactamente 1 orden de compra generada.'
}
Write-Output "OC obraA total=$($ocA[0].total) OC obraB total=$($ocB[0].total)"
```

- [ ] **Step 2: Correr el script contra el proyecto Supabase ya migrado (Task 2 completada)**

Run: `pwsh ./scripts/e2e-fase5.ps1` (o `powershell -File .\scripts\e2e-fase5.ps1` en Windows)
Expected: termina sin excepción, imprime `OK 2 ordenes generadas: ...` y `OC obraA total=... OC obraB total=...` con montos coherentes (obraA: 500 de flete + costo material renglón A si aplicó `monto_mxn`; obraB: 700 + su renglón).

- [ ] **Step 3: Commit**

```bash
git add scripts/e2e-fase5.ps1
git commit -m "test(e2e): script fase5 — escenario feliz multi-obra"
```

---

### Task 4: Extender `e2e-fase5.ps1` — saldo insuficiente (todo o nada) y rechazo por obra

**Files:**
- Modify: `scripts/e2e-fase5.ps1` (agregar al final, después del Escenario 1 de Task 3)

**Interfaces:**
- Consumes: `$url`, `$th`, `$eh`, `$obraA`, `$obraB`, `$matId` ya definidos en el mismo script (Task 3).

- [ ] **Step 1: Agregar escenario 2 (saldo insuficiente → todo o nada) y escenario 3 (rechazo libera por obra)**

```powershell
# --- Escenario 2: saldo insuficiente en una obra -> la aprobacion completa falla ---
$solBody2 = @{ obra_id = $obraA; solicitante_id = $talia.user.id; nota = 'E2E Fase5 saldo insuficiente' } | ConvertTo-Json
$sol2 = (Invoke-RestMethod -Uri "$url/rest/v1/solicitudes_material" -Method POST -Headers $th -Body $solBody2)[0]

$itemsBody2 = @(
  @{ solicitud_id = $sol2.id; obra_id = $obraA; tipo_linea = 'material'; material_id = $matId; cantidad_solicitada = 50 }
  @{ solicitud_id = $sol2.id; obra_id = $obraB; tipo_linea = 'material'; material_id = $matId; cantidad_solicitada = 999999999 }
) | ConvertTo-Json
Invoke-RestMethod -Uri "$url/rest/v1/solicitud_items" -Method POST -Headers $th -Body $itemsBody2 | Out-Null

$fallo = $false
try {
  Invoke-RestMethod -Uri "$url/rest/v1/rpc/aprobar_solicitud_compras" -Method POST -Headers $th -Body (@{ p_solicitud_id = $sol2.id } | ConvertTo-Json) | Out-Null
} catch {
  $fallo = $true
}
if (-not $fallo) {
  throw 'FAIL: la aprobacion debio fallar por saldo insuficiente en obra B.'
}
$reservasSol2 = Invoke-RestMethod -Uri "$url/rest/v1/solicitud_reservas_cantidad?solicitud_id=eq.$($sol2.id)&select=id" -Headers $th
if (@($reservasSol2).Count -ne 0) {
  throw 'FAIL: no debio quedar ninguna reserva parcial tras el fallo de aprobacion.'
}
Write-Output 'OK aprobacion todo-o-nada: saldo insuficiente en una obra bloquea todo, sin reservas parciales'

# --- Escenario 3: rechazo de una requisicion multi-obra ya aprobada libera el dinero correcto a cada obra ---
$solBody3 = @{ obra_id = $obraA; solicitante_id = $talia.user.id; nota = 'E2E Fase5 rechazo' } | ConvertTo-Json
$sol3 = (Invoke-RestMethod -Uri "$url/rest/v1/solicitudes_material" -Method POST -Headers $th -Body $solBody3)[0]
$itemsBody3 = @(
  @{ solicitud_id = $sol3.id; obra_id = $obraA; tipo_linea = 'flete'; descripcion = 'Flete A rechazo'; monto_mxn = 111 }
  @{ solicitud_id = $sol3.id; obra_id = $obraB; tipo_linea = 'flete'; descripcion = 'Flete B rechazo'; monto_mxn = 222 }
) | ConvertTo-Json
Invoke-RestMethod -Uri "$url/rest/v1/solicitud_items" -Method POST -Headers $th -Body $itemsBody3 | Out-Null
Invoke-RestMethod -Uri "$url/rest/v1/rpc/aprobar_solicitud_compras" -Method POST -Headers $th -Body (@{ p_solicitud_id = $sol3.id } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Uri "$url/rest/v1/rpc/rechazar_solicitud" -Method POST -Headers $th -Body (@{ p_solicitud_id = $sol3.id; p_motivo = 'prueba e2e' } | ConvertTo-Json) | Out-Null

$movs = Invoke-RestMethod -Uri "$url/rest/v1/obra_presupuesto_movimientos?solicitud_id=eq.$($sol3.id)&tipo=eq.liberacion&select=obra_id,monto_mxn" -Headers $th
$libA = ($movs | Where-Object { $_.obra_id -eq $obraA }).monto_mxn
$libB = ($movs | Where-Object { $_.obra_id -eq $obraB }).monto_mxn
if ($libA -ne 111 -or $libB -ne 222) {
  throw "FAIL: liberacion incorrecta. obraA=$libA (esperado 111) obraB=$libB (esperado 222)"
}
Write-Output "OK rechazo libera el monto correcto por obra: obraA=$libA obraB=$libB"
```

- [ ] **Step 2: Correr el script completo**

Run: `pwsh ./scripts/e2e-fase5.ps1`
Expected: los 3 escenarios imprimen `OK ...`, cero excepciones no controladas.

- [ ] **Step 3: Commit**

```bash
git add scripts/e2e-fase5.ps1
git commit -m "test(e2e): script fase5 — saldo insuficiente todo-o-nada y rechazo por obra"
```

---

### Task 5: `lib/types.ts` + `lib/validations/solicitud.ts` — soporte de `obra_id` por renglón

**Files:**
- Modify: `lib/types.ts:97-106` (interfaz `SolicitudItem`)
- Modify: `lib/validations/solicitud.ts` (interfaz `SolicitudItemInput`, `validateItem`, `validateSolicitudInput`)

**Interfaces:**
- Consumes: ninguna (capa base de tipos/validación).
- Produces: `SolicitudItemInput.obra_id: string | null`; `validateSolicitudInput` sigue devolviendo `ValidationResult<SolicitudInput>` (firma sin cambios) pero ahora acepta/propaga `obra_id` por renglón y deduplica por `(material_id, obra_efectiva)` en vez de solo `material_id`.

- [ ] **Step 1: `lib/types.ts` — agregar `obra_id` a `SolicitudItem`**

Reemplazar (líneas 97-106):

```ts
export interface SolicitudItem {
  id: string
  solicitud_id: string
  tipo_linea: TipoLineaSolicitud
  material_id: string | null
  cantidad_solicitada: number | null
  descripcion: string | null
  monto_mxn: number | null
  nota: string | null
  obra_id: string | null
}
```

- [ ] **Step 2: `lib/validations/solicitud.ts` — agregar `obra_id` al tipo de entrada**

Reemplazar (líneas 12-19):

```ts
export interface SolicitudItemInput {
  tipo_linea: TipoLineaSolicitud
  material_id: string | null
  cantidad_solicitada: number | null
  descripcion: string | null
  monto_mxn: number | null
  nota: string | null
  obra_id: string | null
}
```

- [ ] **Step 3: `validateItem` — leer y validar `obra_id` opcional**

Agregar, justo después de la línea `const nota = trimOrNull(body.nota)` (línea 53):

```ts
  const obraIdRaw = typeof body.obra_id === 'string' ? body.obra_id.trim() : ''
  const obra_id = obraIdRaw === '' ? null : obraIdRaw
  if (obra_id !== null && !UUID_RE.test(obra_id)) {
    return { ok: false, error: `Renglón ${index + 1}: obra inválida.` }
  }
```

Y agregar `obra_id,` a los dos `return { ok: true, data: { ... } }` de la función (líneas 94-104 y 123-133), en ambos casos junto a `nota,`.

- [ ] **Step 4: `validateSolicitudInput` — deduplicar por material+obra, no solo material**

Reemplazar el bloque de deduplicación (líneas 158-176):

```ts
  const items: SolicitudItemInput[] = []
  const vistos = new Set<string>()

  for (let i = 0; i < body.items.length; i++) {
    const parsedItem = validateItem(body.items[i], i)
    if (!parsedItem.ok) {
      return parsedItem
    }
    if (parsedItem.data.tipo_linea === 'material' && parsedItem.data.material_id) {
      const obraEfectiva = parsedItem.data.obra_id ?? obra_id
      const clave = `${parsedItem.data.material_id}::${obraEfectiva}`
      if (vistos.has(clave)) {
        return {
          ok: false,
          error: `Renglón ${i + 1}: ese material ya está en esa obra dentro de la requisición, combina la cantidad en un solo renglón.`,
        }
      }
      vistos.add(clave)
    }
    items.push(parsedItem.data)
  }
```

(`obra_id` aquí es la variable ya validada de la cabecera, definida arriba en la misma función — línea 142.)

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: errores nuevos únicamente en los consumidores de `SolicitudItemInput`/`insertSolicitudItems` que todavía no mandan `obra_id` (se resuelven en la Task 7) — no debe haber errores dentro de `lib/types.ts` ni `lib/validations/solicitud.ts` mismos.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/validations/solicitud.ts
git commit -m "feat(solicitudes): soporte de obra_id por renglón en tipos y validación"
```

---

### Task 6: `lib/roles.ts` — permiso de requisición multi-obra

**Files:**
- Modify: `lib/roles.ts:15-17`

**Interfaces:**
- Produces: `puedeCrearSolicitudes(rol): boolean` (ahora también `true` para `'compras'`); `puedeCrearSolicitudMultiObra(rol): boolean` (nueva).

- [ ] **Step 1: Ampliar `puedeCrearSolicitudes` y agregar `puedeCrearSolicitudMultiObra`**

Reemplazar (líneas 15-17):

```ts
export function puedeCrearSolicitudes(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'personal' || rol === 'compras'
}

export function puedeCrearSolicitudMultiObra(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'compras'
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos (esta función no tiene consumidores todavía que rompan).

- [ ] **Step 3: Commit**

```bash
git add lib/roles.ts
git commit -m "feat(roles): permitir a Compras crear requisiciones multi-obra"
```

---

### Task 7: `lib/actions/solicitudes.ts` — persistir `obra_id`, validar rol, manejar múltiples OC

**Files:**
- Modify: `lib/actions/solicitudes.ts:31-47` (`insertSolicitudItems`)
- Modify: `lib/actions/solicitudes.ts:49-181` (`createSolicitudAction`)
- Modify: `lib/actions/solicitudes.ts:183-310` (`syncSolicitudPayload`)
- Modify: `lib/actions/solicitudes.ts:389-416` (`aprobarPagoSolicitudAction`)

**Interfaces:**
- Consumes: `puedeCrearSolicitudMultiObra` de `lib/roles.ts` (Task 6); `SolicitudItemInput.obra_id` de `lib/validations/solicitud.ts` (Task 5).
- Produces: `aprobarPagoSolicitudAction` sigue devolviendo `ActionResult`, pero ahora redirige a `/ordenes/:id` solo si se generó **una** orden; si se generó más de una, deja al usuario en la página de la requisición.

- [ ] **Step 1: `insertSolicitudItems` — incluir `obra_id`**

Reemplazar (líneas 36-46):

```ts
  return supabase.from('solicitud_items').insert(
    items.map((item) => ({
      solicitud_id: solicitudId,
      tipo_linea: item.tipo_linea,
      material_id: item.material_id,
      cantidad_solicitada: item.cantidad_solicitada,
      descripcion: item.descripcion,
      monto_mxn: item.monto_mxn,
      nota: item.nota,
      obra_id: item.obra_id,
    }))
  )
```

- [ ] **Step 2: `createSolicitudAction` — bloquear multi-obra a quien no tiene permiso**

Agregar el import al inicio del archivo (junto a los demás de `lib/roles`, línea 7-10):

```ts
import {
  puedeAprobarCompras,
  puedeAprobarPago,
  puedeCrearSolicitudes,
  puedeCrearSolicitudMultiObra,
} from '@/lib/roles'
```

Agregar, justo después del bloque `if (!parsed.ok) { return { error: parsed.error } }` (línea 74-76):

```ts
  if (
    parsed.data.items.some((item) => item.obra_id !== null) &&
    !puedeCrearSolicitudMultiObra(session.rol)
  ) {
    return { error: 'No tienes permiso para requisiciones multi-obra.' }
  }
```

- [ ] **Step 3: `syncSolicitudPayload` — mismo bloqueo**

Agregar el mismo bloque después de `if (!parsed.ok) { return { status: 'conflicto', error: parsed.error } }` (línea 214-216), usando el `return` de tipo `SyncResult`:

```ts
  if (
    parsed.data.items.some((item) => item.obra_id !== null) &&
    !puedeCrearSolicitudMultiObra(session.rol)
  ) {
    return { status: 'conflicto', error: 'No tienes permiso para requisiciones multi-obra.' }
  }
```

- [ ] **Step 4: `aprobarPagoSolicitudAction` — manejar arreglo de órdenes**

Reemplazar el final de la función (líneas 408-415):

```ts
  revalidatePath('/solicitudes')
  revalidatePath(`/solicitudes/${solicitudId}`)
  revalidatePath('/ordenes')
  revalidatePath('/')
  const ordenes = Array.isArray(data) ? (data as string[]) : []
  if (ordenes.length === 1) {
    redirect(`/ordenes/${ordenes[0]}`)
  }
  return { error: null, ok: true }
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/solicitudes.ts
git commit -m "feat(solicitudes): persistir obra_id por renglón y manejar múltiples OC al pagar"
```

---

### Task 8: `components/SolicitudForm.tsx` — toggle multi-obra y obra por renglón

**Files:**
- Modify: `components/SolicitudForm.tsx`

**Interfaces:**
- Consumes: prop nueva `permiteMultiObra?: boolean` (provista por Task 9); `obras: ObraOption[]` (ya existente, se reutiliza para el selector por renglón).
- Produces: cuando `permiteMultiObra` es `true`, el usuario ve un checkbox "Requisición multi-obra"; al activarlo, cada renglón manda su propio `obra_id` en `items_json` y el campo oculto `obra_id` de la cabecera toma el valor del primer renglón.

- [ ] **Step 1: Ampliar `ItemRow`, `nuevaFila` y props del componente**

Reemplazar (líneas 35-67):

```ts
interface ItemRow {
  key: string
  tipo_linea: TipoLineaSolicitud
  material_id: string
  cantidad: string
  descripcion: string
  monto_mxn: string
  nota: string
  obra_id: string
}

function nuevaFila(): ItemRow {
  return {
    key: crypto.randomUUID(),
    tipo_linea: 'material',
    material_id: '',
    cantidad: '',
    descripcion: '',
    monto_mxn: '',
    nota: '',
    obra_id: '',
  }
}

export function SolicitudForm({
  action,
  obras,
  materiales,
  defaultObraId,
  permiteMultiObra = false,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  obras: ObraOption[]
  materiales: MaterialOption[]
  defaultObraId?: string
  permiteMultiObra?: boolean
}) {
  const router = useRouter()
  const [state, formAction] = useFormState(action, initialState)
  const [items, setItems] = useState<ItemRow[]>([nuevaFila()])
  const [multiObra, setMultiObra] = useState(false)
  const [offlineMsg, setOfflineMsg] = useState<string | null>(null)
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const [guardandoOffline, setGuardandoOffline] = useState(false)
```

- [ ] **Step 2: `itemsJson` — incluir `obra_id` por renglón**

Reemplazar (líneas 75-88):

```ts
  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        items.map((item) => ({
          tipo_linea: item.tipo_linea,
          material_id: item.tipo_linea === 'material' ? item.material_id : null,
          cantidad_solicitada: item.tipo_linea === 'material' ? item.cantidad : null,
          descripcion: item.tipo_linea === 'material' ? null : item.descripcion,
          monto_mxn: item.monto_mxn.trim() === '' ? null : item.monto_mxn,
          nota: item.nota,
          obra_id: multiObra && item.obra_id !== '' ? item.obra_id : null,
        }))
      ),
    [items, multiObra]
  )
```

- [ ] **Step 3: Selector de obra de cabecera — ocultarlo en modo multi-obra y mandar un input oculto**

Reemplazar el bloque del selector de proyecto (líneas 223-244):

```tsx
      {permiteMultiObra && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={multiObra}
            onChange={(e) => setMultiObra(e.target.checked)}
          />
          Requisición multi-obra (cada renglón elige su propia obra)
        </label>
      )}

      {multiObra ? (
        <input type="hidden" name="obra_id" value={items[0]?.obra_id ?? ''} />
      ) : (
        <div>
          <label htmlFor="obra_id" className="block text-sm font-medium text-gray-700 mb-1">
            Proyecto
          </label>
          <select
            id="obra_id"
            name="obra_id"
            required
            defaultValue={defaultObraId ?? ''}
            className="input-base"
          >
            <option value="" disabled>
              Selecciona un proyecto
            </option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
                {o.fraccionamiento ? ` · ${o.fraccionamiento}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
```

- [ ] **Step 4: Selector de obra por renglón — solo visible en modo multi-obra**

Insertar, dentro del `.map` de renglones (línea 254 en adelante), justo después del `<select>` de `tipo_linea` que cierra en la línea 289 (`</select>`) y antes de `{item.tipo_linea === 'material' ? (` (línea 291):

```tsx
              {multiObra && (
                <select
                  value={item.obra_id}
                  onChange={(e) => actualizarFila(item.key, { obra_id: e.target.value })}
                  className="input-base"
                  required
                >
                  <option value="" disabled>
                    Selecciona la obra de este renglón
                  </option>
                  {obras.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
              )}
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add components/SolicitudForm.tsx
git commit -m "feat(ui): toggle multi-obra y selector de obra por renglón en SolicitudForm"
```

---

### Task 9: `app/solicitudes/nueva/page.tsx` — habilitar el toggle para Compras

**Files:**
- Modify: `app/solicitudes/nueva/page.tsx`

**Interfaces:**
- Consumes: `puedeCrearSolicitudMultiObra` (Task 6), prop `permiteMultiObra` de `SolicitudForm` (Task 8).

- [ ] **Step 1: Importar el helper y pasar la prop**

Reemplazar la línea de import de roles (línea 6):

```ts
import { puedeCrearSolicitudes, puedeCrearSolicitudMultiObra } from '@/lib/roles'
```

Reemplazar el bloque final del componente (líneas 47-56):

```tsx
      {!obras?.length ? (
        <p className="text-gray-500 text-center py-8">No hay proyectos activos todavía.</p>
      ) : (
        <SolicitudForm
          action={createSolicitudAction}
          obras={obras}
          materiales={materiales ?? []}
          defaultObraId={searchParams.obra}
          permiteMultiObra={puedeCrearSolicitudMultiObra(session.rol)}
        />
      )}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/solicitudes/nueva/page.tsx
git commit -m "feat(ui): habilitar toggle multi-obra en /solicitudes/nueva para Compras"
```

---

### Task 10: `app/solicitudes/[id]/page.tsx` — obra por renglón y órdenes generadas

**Files:**
- Modify: `app/solicitudes/[id]/page.tsx`

**Interfaces:**
- Consumes: columna `solicitud_items.obra_id` (Task 1/2); `ordenes_compra.solicitud_id` (ya existe desde `0007`).

- [ ] **Step 1: Ampliar la interfaz y la consulta**

Reemplazar la interfaz `SolicitudDetalle` (líneas 20-41):

```ts
interface SolicitudDetalle {
  id: string
  estado: EstadoSolicitud
  nota: string | null
  creado_en: string
  solicitante_id: string
  obra: { id: string; nombre: string; fraccionamiento: string | null } | null
  solicitante: { nombre: string } | null
  items: {
    id: string
    tipo_linea: TipoLineaSolicitud | null
    cantidad_solicitada: number | null
    descripcion: string | null
    monto_mxn: number | null
    nota: string | null
    obra_id: string | null
    item_obra: { nombre: string } | null
    material: {
      nombre_base: string
      variante: string | null
      unidad_medida: string
    } | null
  }[]
}

interface OrdenRelacionada {
  id: string
  folio: string
  total: number
  obra: { nombre: string } | null
}
```

Reemplazar la consulta de la solicitud (líneas 82-94) y agregar la consulta de órdenes relacionadas justo después:

```ts
  const { data: solicitud } = await supabase
    .from('solicitudes_material')
    .select(
      `id, estado, nota, creado_en, solicitante_id,
       obra:obras(id, nombre, fraccionamiento),
       solicitante:usuarios(nombre),
       items:solicitud_items(
         id, tipo_linea, cantidad_solicitada, descripcion, monto_mxn, nota, obra_id,
         material:catalogo_materiales(nombre_base, variante, unidad_medida),
         item_obra:obras(nombre)
       )`
    )
    .eq('id', params.id)
    .maybeSingle()

  if (!solicitud) notFound()

  const detalle = solicitud as unknown as SolicitudDetalle
  const esMultiObra = detalle.items.some((i) => i.obra_id)

  const { data: ordenesData } =
    detalle.estado === 'finalizada'
      ? await supabase
          .from('ordenes_compra')
          .select('id, folio, total, obra:obras(nombre)')
          .eq('solicitud_id', params.id)
      : { data: null }
  const ordenesRelacionadas = (ordenesData as unknown as OrdenRelacionada[] | null) ?? []
```

(Esto reemplaza la línea `const detalle = solicitud as unknown as SolicitudDetalle` original en la línea 98 — queda una sola vez, movida arriba junto con las nuevas consultas.)

- [ ] **Step 2: Mostrar la obra de cada renglón cuando es multi-obra**

Insertar, dentro del `.map` de renglones (línea 159 en adelante), justo después de `<p className="text-xs font-semibold text-gray-400 uppercase mb-1">{labelTipoLinea(tipo)}</p>` (línea 165):

```tsx
              {esMultiObra && item.item_obra && (
                <p className="text-xs font-semibold text-teal-700 mb-1">
                  Obra: {item.item_obra.nombre}
                </p>
              )}
```

- [ ] **Step 3: Mostrar las órdenes de compra generadas**

Insertar, después del `</div>` que cierra la lista de renglones (línea 197) y antes de `<div className="space-y-3">` (línea 199):

```tsx
      {ordenesRelacionadas.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Órdenes de compra generadas
          </h2>
          <div className="space-y-2">
            {ordenesRelacionadas.map((oc) => (
              <Link key={oc.id} href={`/ordenes/${oc.id}`} className="card block">
                <div className="flex justify-between">
                  <span className="font-medium">{oc.folio}</span>
                  <span className="text-sm text-gray-500">{oc.obra?.nombre}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{formatMoneyMx(Number(oc.total))}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/solicitudes/[id]/page.tsx
git commit -m "feat(ui): mostrar obra por renglón y órdenes generadas en detalle de requisición"
```

---

### Task 11: `app/solicitudes/page.tsx` — etiqueta "multi-obra" en la lista

**Files:**
- Modify: `app/solicitudes/page.tsx`

**Interfaces:**
- Consumes: `solicitud_items.obra_id` (Task 1/2).

- [ ] **Step 1: Ampliar la interfaz y la consulta**

Reemplazar la interfaz `SolicitudRow` (líneas 12-19):

```ts
interface SolicitudRow {
  id: string
  estado: EstadoSolicitud
  creado_en: string
  obra: { nombre: string; fraccionamiento: string | null } | null
  solicitante: { nombre: string } | null
  items: { id: string; obra_id: string | null }[]
}
```

Reemplazar la consulta (línea 66-71):

```ts
  const { data: solicitudes, error } = await supabase
    .from('solicitudes_material')
    .select(
      'id, estado, creado_en, obra:obras(nombre, fraccionamiento), solicitante:usuarios(nombre), items:solicitud_items(id, obra_id)'
    )
    .order('creado_en', { ascending: false })
```

- [ ] **Step 2: Agregar helper y usarlo en las 3 tarjetas (bandeja Compras, bandeja Finanzas, "Todas")**

Agregar, después de `labelEstado` (después de línea 56):

```ts
function esMultiObra(s: SolicitudRow): boolean {
  return s.items.some((i) => i.obra_id !== null)
}
```

En cada una de las 3 líneas que renderizan `{s.items.length} renglón...` (línea 120, línea 147, línea 182), agregar justo después del `{s.items.length === 1 ? '' : 'es'}` una etiqueta condicional:

```tsx
                  {esMultiObra(s) ? ' · multi-obra' : ''}
```

(queda como texto dentro del mismo `<span>`/`<p>` que ya imprime el conteo de renglones, sin crear un elemento nuevo).

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/solicitudes/page.tsx
git commit -m "feat(ui): etiqueta multi-obra en la lista de solicitudes"
```

---

### Task 12: QA manual end-to-end en la app

**Files:** ninguno (verificación, no código).

**Interfaces:**
- Consumes: todo lo anterior desplegado en un entorno con la migración `0008` aplicada.

- [ ] **Step 1: Levantar el servidor de desarrollo**

Run: `npm run dev`

- [ ] **Step 2: Flujo multi-obra completo**

1. Iniciar sesión como `talia.prueba@example.com`.
2. Ir a `/solicitudes/nueva` → activar "Requisición multi-obra" → agregar 2 renglones, cada uno con una obra distinta y un material o gasto → enviar.
3. Abrir el detalle de la requisición → confirmar que cada renglón muestra su propia obra y que aparece indicado que es multi-obra.
4. Aprobar como Compras (Talía puede aprobar su propia requisición, igual que hoy con cualquier otra).
5. Iniciar sesión como Finanzas (`finanzas` — Blanquita, o usar `acceso_total` si Blanquita no está creada aún en el entorno de prueba) y pagar la requisición.
6. Confirmar que la página se queda en el detalle de la requisición (no redirige a una sola OC) y que aparecen 2 links en "Órdenes de compra generadas", uno por obra.
7. Entrar a cada obra en `/obras/[id]` y confirmar que el saldo bajó lo que le tocaba a cada una, no el total combinado.

Expected: todo lo anterior ocurre sin errores en consola ni mensajes de error en la UI.

- [ ] **Step 3: Rechazo multi-obra**

1. Crear otra requisición multi-obra, aprobarla como Compras.
2. Rechazarla (como Compras o Finanzas).
3. Confirmar en el detalle de cada obra (o en la tabla `obra_presupuesto_movimientos` desde el Table Editor de Supabase) que el dinero se liberó a cada obra por separado, no todo a una.

- [ ] **Step 4: Regresión del flujo normal (Personal, una sola obra)**

1. Iniciar sesión como `guero.prueba@example.com` (rol `personal`).
2. Confirmar que **no** aparece el toggle "Requisición multi-obra" en `/solicitudes/nueva`.
3. Crear una solicitud normal de una sola obra, aprobarla, pagarla, y confirmar que se genera 1 sola OC y que la app redirige directo a `/ordenes/[id]` como siempre.

Expected: el flujo de Personal es indistinguible del comportamiento anterior a este cambio.

- [ ] **Step 5: Cerrar**

No hay commit en esta tarea — es verificación manual. Si algo falla, volver a la tarea correspondiente, corregir, y repetir desde el Step 2 de esta tarea.

---

## Self-Review

**Spec coverage:**
- Modelo de datos (columna `obra_id`, índice único ajustado, constraint de reservas) → Task 1.
- Reglas de negocio (aprobar, pagar, rechazar agrupados por obra) → Task 1, verificados en Tasks 3-4.
- Interfaz (toggle multi-obra, obra por renglón, lista con etiqueta, links a OC generadas) → Tasks 8-11.
- Manejo de errores (todo o nada, duplicado por obra, liberación correcta al rechazar) → cubierto en Task 1 (SQL) y verificado en Task 4 (e2e) y Task 12 (manual).
- Plan de pruebas del spec (regresión + 4 casos nuevos) → Tasks 3, 4 y 12.
- Fuera de alcance (consumo físico, aprobación parcial, traspasos) → no se tocó nada de eso en ninguna tarea.

**Placeholder scan:** sin `TBD`/`TODO`/pasos sin código. Cada paso de código trae el bloque completo a escribir.

**Type consistency:** `SolicitudItemInput.obra_id` (Task 5) es consumido igual en `insertSolicitudItems` (Task 7), `SolicitudForm` (Task 8) y las páginas de lectura (Tasks 10-11) — mismo nombre y tipo (`string | null`) en todos lados. `aprobar_pago_solicitud` devuelve `uuid[]` (Task 1) y se consume como arreglo en `aprobarPagoSolicitudAction` (Task 7) — mismo tipo en ambos lados.
