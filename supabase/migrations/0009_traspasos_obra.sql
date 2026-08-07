-- =====================================================================
-- MIGRACIÓN 0009 — Traspasos entre obras (Fase 6)
-- Permite transferir excedentes de material entre obras de origen y destino.
-- Afecta los saldos en vivo (v_saldo_material_obra) de ambas obras.
-- =====================================================================

-- 1. Secuencia de folios para traspasos (TR-00001, TR-00002...)
create sequence if not exists traspasos_folio_seq start 1;

create or replace function next_folio_traspaso()
returns text
language sql
security definer
set search_path = public
as $$
    select 'TR-' || lpad(nextval('traspasos_folio_seq')::text, 5, '0');
$$;

revoke all on function public.next_folio_traspaso() from public;
revoke all on function public.next_folio_traspaso() from anon;
grant execute on function public.next_folio_traspaso() to authenticated;

-- 2. Tabla principal de traspasos
create table traspasos_obra (
    id              uuid primary key default gen_random_uuid(),
    folio           text not null unique default next_folio_traspaso(),
    obra_origen_id  uuid not null references obras(id) on delete cascade,
    obra_destino_id uuid not null references obras(id) on delete cascade,
    solicitante_id  uuid not null references usuarios(id),
    aprobador_id    uuid references usuarios(id),
    receptor_id     uuid references usuarios(id),
    estado          text not null default 'solicitado'
                        check (estado in ('solicitado', 'en_transito', 'completado', 'rechazado', 'cancelado')),
    motivo          text,
    creado_en       timestamptz not null default now(),
    aprobado_en     timestamptz,
    recibido_en     timestamptz,
    constraint traspasos_obras_distintas_check check (obra_origen_id <> obra_destino_id)
);

create index idx_traspasos_obra_origen on traspasos_obra(obra_origen_id);
create index idx_traspasos_obra_destino on traspasos_obra(obra_destino_id);
create index idx_traspasos_solicitante on traspasos_obra(solicitante_id);
create index idx_traspasos_estado on traspasos_obra(estado);

-- 3. Items de traspaso
create table traspaso_items (
    id              uuid primary key default gen_random_uuid(),
    traspaso_id     uuid not null references traspasos_obra(id) on delete cascade,
    material_id     uuid not null references catalogo_materiales(id),
    cantidad        numeric(12,2) not null check (cantidad > 0),
    -- Valuación del renglón. La llena aprobar_traspaso() con el último precio
    -- de compra y ahí queda CONGELADA: el dinero que se mueve entre las dos
    -- obras tiene que ser auditable y no cambiar si el material se vuelve a
    -- comprar más caro después. Null = todavía no aprobado.
    precio_unitario_mxn numeric(14,2) check (precio_unitario_mxn >= 0),
    creado_en       timestamptz not null default now(),
    unique (traspaso_id, material_id)
);

create index idx_traspaso_items_traspaso on traspaso_items(traspaso_id);
create index idx_traspaso_items_material on traspaso_items(material_id);

-- 4. RLS y Auditoría en tablas nuevas
alter table traspasos_obra enable row level security;
alter table traspaso_items enable row level security;

create policy traspasos_obra_select on traspasos_obra for select
    using (auth.uid() is not null);

create policy traspasos_obra_insert on traspasos_obra for insert
    with check (
        solicitante_id = auth.uid()
        and auth_rol() in ('personal', 'proyectos', 'operacion', 'compras', 'acceso_total')
    );

-- La policy de UPDATE dice QUIÉN puede tocar el renglón; QUÉ transiciones son
-- válidas lo decide el trigger fn_traspasos_obra_before_update() más abajo.
-- Sin ese trigger, cualquiera de estos roles podría hacer un PATCH directo a
-- PostgREST con {"estado":"completado"} y mover material entre obras sin
-- aprobación ni validación de saldo (v_saldo_material_obra se calcula a partir
-- de `estado`). Mismo patrón que solicitudes_material en 0007.
create policy traspasos_obra_update on traspasos_obra for update
    using (
        solicitante_id = auth.uid()
        or auth_rol() in ('proyectos', 'operacion', 'compras', 'acceso_total')
    )
    with check (
        solicitante_id = auth.uid()
        or auth_rol() in ('proyectos', 'operacion', 'compras', 'acceso_total')
    );

create policy traspaso_items_select on traspaso_items for select
    using (auth.uid() is not null);

-- Los renglones solo se pueden tocar mientras el traspaso sigue en
-- 'solicitado'. Una vez aprobado, sus cantidades ya están afectando el saldo
-- de las dos obras: agregar o mover un renglón después sería mover material
-- sin que nadie lo autorice.
create policy traspaso_items_insert on traspaso_items for insert
    with check (
        auth_rol() in ('personal', 'proyectos', 'operacion', 'compras', 'acceso_total')
        and exists (
            select 1 from traspasos_obra t
            where t.id = traspaso_id
              and t.estado = 'solicitado'
        )
    );

create policy traspaso_items_update on traspaso_items for update
    using (
        auth_rol() in ('proyectos', 'operacion', 'compras', 'acceso_total')
        and exists (
            select 1 from traspasos_obra t
            where t.id = traspaso_id
              and t.estado = 'solicitado'
        )
    );

create policy traspaso_items_delete on traspaso_items for delete
    using (
        auth_rol() in ('proyectos', 'operacion', 'compras', 'acceso_total')
        and exists (
            select 1 from traspasos_obra t
            where t.id = traspaso_id
              and t.estado = 'solicitado'
        )
    );

create trigger trg_auditoria_traspasos_obra
    after insert or update or delete on traspasos_obra
    for each row execute function fn_auditoria();

create trigger trg_auditoria_traspaso_items
    after insert or update or delete on traspaso_items
    for each row execute function fn_auditoria();

-- 5. Actualización de v_saldo_material_obra para incorporar traspasos
--
-- OJO: NO se puede usar `create or replace view` aquí. Postgres exige que el
-- reemplazo conserve las columnas existentes con el mismo nombre, tipo y
-- POSICIÓN (solo deja agregar columnas al final), y esta versión intercala
-- traspasos_entrada / traspasos_salida en medio. Sin el drop revienta con
-- "cannot change name of view column". Es el mismo tropiezo del commit
-- b8491e0 en la Fase 4 — no lo repitamos.
--
-- El drop va SIN cascade a propósito: en el orden normal (0009 antes que
-- 0010) nada depende todavía de la vista. Si alguien re-corre esta migración
-- con 0010 ya aplicada, el drop va a fallar por la dependencia de
-- v_conciliacion_obra_material — y eso es lo que queremos: mejor que truene
-- ruidoso a que un cascade se lleve la vista de conciliación en silencio.
drop view if exists v_saldo_material_obra;

create view v_saldo_material_obra
with (security_invoker = true)
as
with obras_materiales as (
    select obra_id, material_id, cantidad_contratada
    from obra_material_contratado
    union
    select t.obra_destino_id as obra_id, ti.material_id, 0::numeric as cantidad_contratada
    from traspasos_obra t
    join traspaso_items ti on ti.traspaso_id = t.id
    where t.estado = 'completado'
)
select
    om.obra_id,
    om.material_id,
    cm.nombre_base,
    cm.variante,
    cm.unidad_medida,
    -- numeric(12,2) explícito: la columna original ya lo era y al envolverla en
    -- sum() se perdía la precisión declarada (regresión del fix fff843b).
    coalesce(sum(om.cantidad_contratada), 0)::numeric(12,2) as cantidad_contratada,
    coalesce((
        select sum(ti.cantidad)
        from traspasos_obra t
        join traspaso_items ti on ti.traspaso_id = t.id
        where t.obra_destino_id = om.obra_id
          and ti.material_id = om.material_id
          and t.estado = 'completado'
    ), 0)::numeric(12,2) as traspasos_entrada,
    coalesce((
        select sum(ti.cantidad)
        from traspasos_obra t
        join traspaso_items ti on ti.traspaso_id = t.id
        where t.obra_origen_id = om.obra_id
          and ti.material_id = om.material_id
          and t.estado in ('en_transito', 'completado')
    ), 0)::numeric(12,2) as traspasos_salida,
    coalesce((
        select sum(r.cantidad)
        from solicitud_reservas_cantidad r
        where r.obra_id = om.obra_id
          and r.material_id = om.material_id
          and r.estado = 'aplicada'
    ), 0)::numeric as cantidad_usada,
    coalesce((
        select sum(r.cantidad)
        from solicitud_reservas_cantidad r
        where r.obra_id = om.obra_id
          and r.material_id = om.material_id
          and r.estado = 'activa'
    ), 0)::numeric as cantidad_comprometida,
    (
        coalesce(sum(om.cantidad_contratada), 0)
        + coalesce((
            select sum(ti.cantidad)
            from traspasos_obra t
            join traspaso_items ti on ti.traspaso_id = t.id
            where t.obra_destino_id = om.obra_id
              and ti.material_id = om.material_id
              and t.estado = 'completado'
        ), 0)
        - coalesce((
            select sum(ti.cantidad)
            from traspasos_obra t
            join traspaso_items ti on ti.traspaso_id = t.id
            where t.obra_origen_id = om.obra_id
              and ti.material_id = om.material_id
              and t.estado in ('en_transito', 'completado')
        ), 0)
        - coalesce((
            select sum(r.cantidad)
            from solicitud_reservas_cantidad r
            where r.obra_id = om.obra_id
              and r.material_id = om.material_id
              and r.estado in ('activa', 'aplicada')
        ), 0)
    )::numeric(12,2) as cantidad_disponible
from obras_materiales om
join catalogo_materiales cm on cm.id = om.material_id
group by om.obra_id, om.material_id, cm.nombre_base, cm.variante, cm.unidad_medida;

grant select on v_saldo_material_obra to authenticated;

-- =====================================================================
-- 5b. Valuación del traspaso
-- =====================================================================

-- Último precio de compra conocido de un material, para valuar el traspaso.
-- Prioriza lo que pagó la propia obra origen; si esa obra nunca lo compró
-- (p. ej. le llegó por un traspaso anterior), cae al último precio de
-- cualquier obra. Si el material nunca se ha comprado por el sistema devuelve
-- 0: el traspaso se deja pasar pero sin mover dinero, y eso queda visible en
-- la pantalla del traspaso en vez de inventar un costo.
create or replace function precio_referencia_material(p_material_id uuid, p_obra_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (
            select oci.precio_unitario
            from orden_compra_items oci
            join ordenes_compra oc on oc.id = oci.orden_id
            where oci.material_id = p_material_id
              and oc.obra_id = p_obra_id
              and oc.estado <> 'cancelada'
            order by oc.creado_en desc
            limit 1
        ),
        (
            select oci.precio_unitario
            from orden_compra_items oci
            join ordenes_compra oc on oc.id = oci.orden_id
            where oci.material_id = p_material_id
              and oc.estado <> 'cancelada'
            order by oc.creado_en desc
            limit 1
        ),
        0
    );
$$;

-- =====================================================================
-- 5c. El dinero sigue al material
--
-- Un traspaso completado abona a la obra origen (recupera lo que pagó por
-- material que se llevó otra obra) y carga a la destino. Se calcula aquí, a
-- partir de las tablas de traspaso, en vez de escribir en
-- obra_presupuesto_movimientos, por dos razones:
--   1. Esa tabla tiene `check (monto_mxn > 0)` y sus tipos son
--      reserva/gasto/liberacion — no existe forma de DEVOLVER dinero ya
--      gastado, y agregar un valor al enum tipo_movimiento_presupuesto no se
--      puede usar en la misma transacción que lo agrega (Postgres lo prohíbe).
--   2. Es el mismo patrón que v_saldo_material_obra ya usa para las
--      cantidades, así que las dos mitades del traspaso se leen igual.
-- El rastro de auditoría son las propias filas de traspasos_obra, que ya
-- tienen su trigger fn_auditoria.
-- =====================================================================
-- Mismo criterio que con v_saldo_material_obra arriba: drop explícito (la vista
-- viene de 0006 y aquí cambia de columnas), y SIN cascade. Al correr 0009 sobre
-- una base con 0001–0008 nada depende de ella todavía, así que el drop pasa
-- limpio. Si se re-corre esta migración con 0010 ya aplicada va a fallar por
-- v_conciliacion_obra_presupuesto — y eso es lo deseable: mejor un error visible
-- que un cascade que se lleve la vista de conciliación en silencio.
drop view if exists v_saldo_presupuesto_obra;

create view v_saldo_presupuesto_obra
with (security_invoker = true)
as
with mov as (
    select
        o.id as obra_id,
        o.presupuesto_mxn,
        coalesce(sum(case when m.tipo = 'reserva' then m.monto_mxn else 0 end), 0)
            - coalesce(sum(case when m.tipo = 'liberacion' then m.monto_mxn else 0 end), 0)
            as comprometido,
        coalesce(sum(case when m.tipo = 'gasto' then m.monto_mxn else 0 end), 0)
            as gasto_directo
    from obras o
    left join obra_presupuesto_movimientos m on m.obra_id = o.id
    group by o.id, o.presupuesto_mxn
),
tr as (
    select
        o.id as obra_id,
        coalesce((
            select sum(ti.cantidad * coalesce(ti.precio_unitario_mxn, 0))
            from traspasos_obra t
            join traspaso_items ti on ti.traspaso_id = t.id
            where t.obra_origen_id = o.id and t.estado = 'completado'
        ), 0) as credito,
        coalesce((
            select sum(ti.cantidad * coalesce(ti.precio_unitario_mxn, 0))
            from traspasos_obra t
            join traspaso_items ti on ti.traspaso_id = t.id
            where t.obra_destino_id = o.id and t.estado = 'completado'
        ), 0) as cargo
    from obras o
)
select
    mov.obra_id,
    mov.presupuesto_mxn,
    mov.comprometido as comprometido_mxn,
    (mov.gasto_directo + tr.cargo - tr.credito) as gastado_mxn,
    (
        mov.presupuesto_mxn
        - mov.comprometido
        - (mov.gasto_directo + tr.cargo - tr.credito)
    ) as disponible_mxn,
    tr.credito as traspasos_credito_mxn,
    tr.cargo as traspasos_cargo_mxn
from mov
join tr on tr.obra_id = mov.obra_id;

grant select on v_saldo_presupuesto_obra to authenticated;

-- =====================================================================
-- 5d. Guardias de integridad
--
-- Las RPCs de abajo son el camino oficial, pero PostgREST expone UPDATE
-- directo sobre traspasos_obra a los mismos roles. Como el saldo de las dos
-- obras (cantidad Y dinero) se calcula a partir de `estado`, un PATCH crudo
-- movería material y presupuesto sin aprobación ni validación. Estos triggers
-- son el choke point real: corren pasen por donde pasen los cambios,
-- incluidas las RPCs security definer.
-- =====================================================================

-- Saldo suficiente en la obra origen para TODOS los renglones del traspaso.
-- Vive aquí (y no inline) para que la RPC y el trigger validen exactamente lo
-- mismo, sin duplicar la consulta.
--
-- Es `stable` a propósito: solo lee CANTIDADES (v_saldo_material_obra), y como
-- corre en un BEFORE UPDATE el traspaso todavía figura en su estado anterior,
-- que es justo lo que queremos comparar ("¿alcanza ANTES de mover?").
-- Si algún día esta validación también mirara dinero, revisa este `stable`:
-- aprobar_traspaso escribe precio_unitario_mxn justo antes de llamarla.
create or replace function traspaso_saldo_suficiente(p_traspaso_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_origen uuid;
    v_item record;
    v_disponible numeric(12,2);
begin
    select obra_origen_id into v_origen from traspasos_obra where id = p_traspaso_id;
    if v_origen is null then
        return false;
    end if;

    for v_item in
        select material_id, cantidad from traspaso_items where traspaso_id = p_traspaso_id
    loop
        select cantidad_disponible into v_disponible
        from v_saldo_material_obra
        where obra_id = v_origen and material_id = v_item.material_id;

        if v_disponible is null or v_disponible < v_item.cantidad then
            return false;
        end if;
    end loop;

    return true;
end;
$$;

create or replace function fn_traspasos_obra_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    rol rol_usuario := auth_rol();
begin
    -- Inmutables para todos, incluido acceso_total: cambiarlos reescribiría
    -- la trazabilidad y movería saldos ya calculados a otras obras.
    if NEW.folio is distinct from OLD.folio
       or NEW.obra_origen_id is distinct from OLD.obra_origen_id
       or NEW.obra_destino_id is distinct from OLD.obra_destino_id
       or NEW.solicitante_id is distinct from OLD.solicitante_id
       or NEW.creado_en is distinct from OLD.creado_en then
        raise exception 'No se pueden modificar folio, obras, solicitante ni fecha de creación de un traspaso.';
    end if;

    if NEW.estado is not distinct from OLD.estado then
        return NEW;
    end if;

    if rol is null then
        raise exception 'No autenticado.';
    end if;

    -- Máquina de estados. A diferencia de solicitudes_material, aquí
    -- acceso_total NO tiene pase libre: la Fase 6 mueve inventario físico
    -- entre dos obras y un salto de estado inválido descuadra las dos.
    if not (
        (OLD.estado = 'solicitado' and NEW.estado in ('en_transito', 'rechazado', 'cancelado'))
        or (OLD.estado = 'en_transito' and NEW.estado in ('completado', 'rechazado'))
    ) then
        raise exception 'Transición de estado no permitida para un traspaso (% -> %).',
            OLD.estado, NEW.estado;
    end if;

    -- Quién puede hacer cada transición (mismos roles que las RPCs).
    if NEW.estado = 'en_transito' then
        if rol not in ('proyectos', 'operacion', 'compras', 'acceso_total') then
            raise exception 'Solo el personal autorizado puede aprobar traspasos.';
        end if;
        if not traspaso_saldo_suficiente(NEW.id) then
            raise exception 'Saldo insuficiente en la obra origen para un material del traspaso.';
        end if;

    elsif NEW.estado = 'rechazado' then
        if rol not in ('proyectos', 'operacion', 'compras', 'acceso_total') then
            raise exception 'Solo personal autorizado puede rechazar traspasos.';
        end if;

    elsif NEW.estado = 'completado' then
        if rol not in ('personal', 'proyectos', 'operacion', 'compras', 'acceso_total') then
            raise exception 'No tiene permisos para confirmar la recepción.';
        end if;

    elsif NEW.estado = 'cancelado' then
        if OLD.solicitante_id <> auth.uid() and rol not in ('proyectos', 'acceso_total') then
            raise exception 'No tiene permisos para cancelar este traspaso.';
        end if;
    end if;

    return NEW;
end;
$$;

create trigger trg_traspasos_obra_before_update
    before update on traspasos_obra
    for each row execute function fn_traspasos_obra_before_update();

-- Los renglones son inmutables en cuanto el traspaso deja de estar
-- 'solicitado'. Las policies ya lo bloquean para el cliente; el trigger lo
-- garantiza también para cualquier función security definer futura.
create or replace function fn_traspaso_items_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_traspaso_id uuid := coalesce(NEW.traspaso_id, OLD.traspaso_id);
    v_estado text;
begin
    select estado into v_estado from traspasos_obra where id = v_traspaso_id;

    -- Padre inexistente en un DELETE = venimos de un `on delete cascade`
    -- (se borró el traspaso o la obra). Dejar pasar, si no rompemos el cascade.
    if v_estado is null then
        if TG_OP = 'DELETE' then
            return OLD;
        end if;
        raise exception 'El traspaso del renglón no existe.';
    end if;

    if v_estado <> 'solicitado' then
        raise exception 'No se pueden modificar los materiales de un traspaso que ya está en estado %.', v_estado;
    end if;

    if TG_OP = 'DELETE' then
        return OLD;
    end if;
    return NEW;
end;
$$;

create trigger trg_traspaso_items_guard
    before insert or update or delete on traspaso_items
    for each row execute function fn_traspaso_items_guard();

-- 6. RPC: crear_solicitud_traspaso
create or replace function crear_solicitud_traspaso(
    p_obra_origen_id uuid,
    p_obra_destino_id uuid,
    p_motivo text,
    p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_rol rol_usuario := auth_rol();
    v_traspaso_id uuid;
    v_item jsonb;
    v_material_id uuid;
    v_cantidad numeric(12,2);
    v_obra_orig_estado text;
    v_obra_dest_estado text;
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;

    if v_rol not in ('personal', 'proyectos', 'operacion', 'compras', 'acceso_total') then
        raise exception 'No tiene permisos para solicitar traspasos.';
    end if;

    if p_obra_origen_id = p_obra_destino_id then
        raise exception 'La obra origen y destino no pueden ser la misma.';
    end if;

    select estado into v_obra_orig_estado from obras where id = p_obra_origen_id;
    if v_obra_orig_estado <> 'activa' then
        raise exception 'La obra origen debe estar activa.';
    end if;

    select estado into v_obra_dest_estado from obras where id = p_obra_destino_id;
    if v_obra_dest_estado <> 'activa' then
        raise exception 'La obra destino debe estar activa.';
    end if;

    if jsonb_array_length(p_items) = 0 then
        raise exception 'Debe incluir al menos un material para traspaso.';
    end if;

    insert into traspasos_obra (
        obra_origen_id, obra_destino_id, solicitante_id, motivo, estado
    ) values (
        p_obra_origen_id, p_obra_destino_id, v_uid, p_motivo, 'solicitado'
    ) returning id into v_traspaso_id;

    for v_item in select * from jsonb_array_elements(p_items) loop
        v_material_id := (v_item->>'material_id')::uuid;
        v_cantidad := (v_item->>'cantidad')::numeric;

        if v_material_id is null or v_cantidad is null or v_cantidad <= 0 then
            raise exception 'Material o cantidad inválida en el traspaso.';
        end if;

        insert into traspaso_items (traspaso_id, material_id, cantidad)
        values (v_traspaso_id, v_material_id, v_cantidad);
    end loop;

    insert into notificaciones (rol_destino, titulo, mensaje, tipo, referencia_id)
    values (
        'proyectos',
        'Nueva solicitud de traspaso',
        'Se ha solicitado un traspaso de materiales entre obras.',
        'traspaso_solicitado',
        v_traspaso_id
    );

    return v_traspaso_id;
end;
$$;

-- 7. RPC: aprobar_traspaso
create or replace function aprobar_traspaso(p_traspaso_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_rol rol_usuario := auth_rol();
    v_traspaso traspasos_obra%rowtype;
    v_monto numeric(14,2);
    v_disponible_dest numeric(14,2);
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;

    if v_rol not in ('proyectos', 'operacion', 'compras', 'acceso_total') then
        raise exception 'Solo el personal autorizado puede aprobar traspasos.';
    end if;

    select * into v_traspaso from traspasos_obra where id = p_traspaso_id for update;
    if not found then
        raise exception 'El traspaso no existe.';
    end if;

    if v_traspaso.estado <> 'solicitado' then
        raise exception 'Solo se pueden aprobar traspasos en estado solicitado.';
    end if;

    -- Validación de saldo compartida con el trigger (misma función, un solo
    -- criterio). El `for update` de arriba serializa dos aprobaciones
    -- simultáneas del mismo traspaso.
    if not traspaso_saldo_suficiente(p_traspaso_id) then
        raise exception 'Saldo insuficiente en la obra origen para un material del traspaso.';
    end if;

    -- Congelar la valuación de cada renglón al aprobar. Va ANTES de cambiar el
    -- estado porque fn_traspaso_items_guard solo deja tocar renglones mientras
    -- el traspaso sigue en 'solicitado'.
    update traspaso_items ti
    set precio_unitario_mxn = precio_referencia_material(ti.material_id, v_traspaso.obra_origen_id)
    where ti.traspaso_id = p_traspaso_id;

    select coalesce(sum(ti.cantidad * coalesce(ti.precio_unitario_mxn, 0)), 0)
    into v_monto
    from traspaso_items ti
    where ti.traspaso_id = p_traspaso_id;

    -- La obra destino va a absorber ese costo cuando el traspaso se complete;
    -- se valida aquí, igual que aprobar_solicitud_compras valida el
    -- presupuesto antes de reservar.
    if v_monto > 0 then
        select disponible_mxn into v_disponible_dest
        from v_saldo_presupuesto_obra
        where obra_id = v_traspaso.obra_destino_id;

        if coalesce(v_disponible_dest, 0) < v_monto then
            raise exception 'Presupuesto monetario insuficiente en la obra destino para absorber el costo del traspaso (% MXN).', v_monto;
        end if;
    end if;

    update traspasos_obra
    set estado = 'en_transito',
        aprobador_id = v_uid,
        aprobado_en = now()
    where id = p_traspaso_id;

    insert into notificaciones (usuario_id, titulo, mensaje, tipo, referencia_id)
    values (
        v_traspaso.solicitante_id,
        'Traspaso en tránsito',
        'El traspaso ' || v_traspaso.folio || ' fue aprobado y va en camino.',
        'traspaso_en_transito',
        p_traspaso_id
    );
end;
$$;

-- 8. RPC: confirmar_recepcion_traspaso
create or replace function confirmar_recepcion_traspaso(p_traspaso_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_rol rol_usuario := auth_rol();
    v_traspaso traspasos_obra%rowtype;
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;

    if v_rol not in ('personal', 'proyectos', 'operacion', 'compras', 'acceso_total') then
        raise exception 'No tiene permisos para confirmar la recepción.';
    end if;

    select * into v_traspaso from traspasos_obra where id = p_traspaso_id for update;
    if not found then
        raise exception 'El traspaso no existe.';
    end if;

    if v_traspaso.estado <> 'en_transito' then
        raise exception 'Solo se pueden confirmar traspasos que estén en tránsito.';
    end if;

    update traspasos_obra
    set estado = 'completado',
        receptor_id = v_uid,
        recibido_en = now()
    where id = p_traspaso_id;

    insert into notificaciones (usuario_id, titulo, mensaje, tipo, referencia_id)
    values (
        v_traspaso.solicitante_id,
        'Traspaso completado',
        'El traspaso ' || v_traspaso.folio || ' fue recibido con éxito en la obra destino.',
        'traspaso_completado',
        p_traspaso_id
    );
end;
$$;

-- 9. RPC: rechazar_traspaso
create or replace function rechazar_traspaso(p_traspaso_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_rol rol_usuario := auth_rol();
    v_traspaso traspasos_obra%rowtype;
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;

    if v_rol not in ('proyectos', 'operacion', 'compras', 'acceso_total') then
        raise exception 'Solo personal autorizado puede rechazar traspasos.';
    end if;

    select * into v_traspaso from traspasos_obra where id = p_traspaso_id for update;
    if not found then
        raise exception 'El traspaso no existe.';
    end if;

    if v_traspaso.estado not in ('solicitado', 'en_transito') then
        raise exception 'No se puede rechazar un traspaso en estado final.';
    end if;

    update traspasos_obra
    set estado = 'rechazado',
        aprobador_id = v_uid,
        motivo = coalesce(motivo, '') || case when p_motivo is not null then ' | Motivo rechazo: ' || p_motivo else '' end
    where id = p_traspaso_id;

    insert into notificaciones (usuario_id, titulo, mensaje, tipo, referencia_id)
    values (
        v_traspaso.solicitante_id,
        'Traspaso rechazado',
        'El traspaso ' || v_traspaso.folio || ' fue rechazado.',
        'traspaso_rechazado',
        p_traspaso_id
    );
end;
$$;

-- 10. RPC: cancelar_traspaso
create or replace function cancelar_traspaso(p_traspaso_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_rol rol_usuario := auth_rol();
    v_traspaso traspasos_obra%rowtype;
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;

    select * into v_traspaso from traspasos_obra where id = p_traspaso_id for update;
    if not found then
        raise exception 'El traspaso no existe.';
    end if;

    if v_traspaso.solicitante_id <> v_uid and v_rol not in ('proyectos', 'acceso_total') then
        raise exception 'No tiene permisos para cancelar este traspaso.';
    end if;

    if v_traspaso.estado <> 'solicitado' then
        raise exception 'Solo se pueden cancelar traspasos en estado solicitado.';
    end if;

    update traspasos_obra
    set estado = 'cancelado'
    where id = p_traspaso_id;
end;
$$;

-- Postgres le da EXECUTE a PUBLIC por defecto en cada función nueva. Aunque
-- todas revientan con 'No autenticado.' cuando auth.uid() es null, se revoca
-- explícitamente para que anon no las tenga ni listadas — mismo criterio que
-- next_folio_traspaso() arriba.
revoke all on function public.crear_solicitud_traspaso(uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.aprobar_traspaso(uuid) from public, anon;
revoke all on function public.confirmar_recepcion_traspaso(uuid) from public, anon;
revoke all on function public.rechazar_traspaso(uuid, text) from public, anon;
revoke all on function public.cancelar_traspaso(uuid) from public, anon;

grant execute on function public.crear_solicitud_traspaso(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.aprobar_traspaso(uuid) to authenticated;
grant execute on function public.confirmar_recepcion_traspaso(uuid) to authenticated;
grant execute on function public.rechazar_traspaso(uuid, text) to authenticated;
grant execute on function public.cancelar_traspaso(uuid) to authenticated;

-- Helpers internos: los llaman el trigger y las RPCs (security definer, como
-- owner), así que nadie necesita EXECUTE directo.
revoke all on function public.traspaso_saldo_suficiente(uuid) from public, anon, authenticated;
revoke all on function public.precio_referencia_material(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fn_traspasos_obra_before_update() from public, anon, authenticated;
revoke all on function public.fn_traspaso_items_guard() from public, anon, authenticated;
