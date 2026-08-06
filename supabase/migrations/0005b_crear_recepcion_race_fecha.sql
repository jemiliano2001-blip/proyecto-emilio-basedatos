-- =====================================================================
-- MIGRACIÓN 0005b — Endurecer crear_recepcion (race offline + rango fecha)
-- Corrige hallazgos del review de Fase 4:
-- 1) Race en idempotencia: unique_violation → retorno idempotente
-- 2) recibido_en con ventana razonable (±7d / +1h)
-- 3) Prefijo [CONFLICTO] estable para clasificación en sync
-- =====================================================================

create or replace function crear_recepcion(
    p_id uuid,
    p_orden_id uuid,
    p_referencia_entrega text,
    p_nota text,
    p_recibido_en timestamptz,
    p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol rol_usuario := auth_rol();
    v_uid uuid := auth.uid();
    v_existente recepciones_material%rowtype;
    v_oc ordenes_compra%rowtype;
    v_item jsonb;
    v_orden_item_id uuid;
    v_cant_buena numeric(12,2);
    v_cant_danada numeric(12,2);
    v_estado estado_recepcion_item;
    v_obs text;
    v_oci orden_compra_items%rowtype;
    v_count int := 0;
    v_recibido_en timestamptz;
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;
    if v_rol not in ('personal', 'compras', 'acceso_total') then
        raise exception 'Sin permiso para registrar recepciones.';
    end if;
    if p_id is null or p_orden_id is null then
        raise exception 'Datos de recepción incompletos.';
    end if;
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'La recepción debe tener al menos un renglón.';
    end if;
    if jsonb_array_length(p_items) > 100 then
        raise exception 'Demasiados renglones en una recepción.';
    end if;

    v_recibido_en := coalesce(p_recibido_en, now());
    if v_recibido_en < now() - interval '7 days'
       or v_recibido_en > now() + interval '1 hour' then
        raise exception '[CONFLICTO] Fecha de recepción fuera de rango permitido.';
    end if;

    select * into v_existente from recepciones_material where id = p_id;
    if found then
        if v_existente.receptor_id <> v_uid and v_rol <> 'acceso_total' then
            raise exception '[CONFLICTO] esa recepción ya existe con otro receptor.';
        end if;
        if v_existente.orden_id <> p_orden_id then
            raise exception '[CONFLICTO] el UUID ya está ligado a otra orden.';
        end if;
        return v_existente.id;
    end if;

    select * into v_oc from ordenes_compra where id = p_orden_id for update;
    if not found then
        raise exception '[CONFLICTO] La orden de compra no existe.';
    end if;
    if v_oc.estado not in ('emitida', 'parcialmente_recibida') then
        raise exception '[CONFLICTO] Esta orden ya no admite recepciones.';
    end if;

    begin
        insert into recepciones_material (
            id, orden_id, receptor_id, estado, referencia_entrega, nota, recibido_en
        ) values (
            p_id,
            p_orden_id,
            v_uid,
            'pendiente_revision',
            nullif(trim(coalesce(p_referencia_entrega, '')), ''),
            nullif(trim(coalesce(p_nota, '')), ''),
            v_recibido_en
        );
    exception
        when unique_violation then
            select * into v_existente from recepciones_material where id = p_id;
            if not found then
                raise;
            end if;
            if v_existente.receptor_id <> v_uid and v_rol <> 'acceso_total' then
                raise exception '[CONFLICTO] esa recepción ya existe con otro receptor.';
            end if;
            if v_existente.orden_id <> p_orden_id then
                raise exception '[CONFLICTO] el UUID ya está ligado a otra orden.';
            end if;
            return v_existente.id;
    end;

    for v_item in select * from jsonb_array_elements(p_items)
    loop
        v_orden_item_id := (v_item->>'orden_item_id')::uuid;
        v_cant_buena := coalesce((v_item->>'cantidad_recibida')::numeric, 0);
        v_cant_danada := coalesce((v_item->>'cantidad_danada')::numeric, 0);
        v_estado := (v_item->>'estado')::estado_recepcion_item;
        v_obs := nullif(trim(coalesce(v_item->>'observacion', '')), '');

        if v_orden_item_id is null then
            raise exception '[CONFLICTO] Renglón sin orden_item_id.';
        end if;
        if v_cant_buena < 0 or v_cant_danada < 0 then
            raise exception '[CONFLICTO] Las cantidades no pueden ser negativas.';
        end if;
        if round(v_cant_buena, 2) <> v_cant_buena or round(v_cant_danada, 2) <> v_cant_danada then
            raise exception '[CONFLICTO] Las cantidades solo admiten 2 decimales.';
        end if;

        select * into v_oci from orden_compra_items
        where id = v_orden_item_id and orden_id = p_orden_id;
        if not found then
            raise exception '[CONFLICTO] Un renglón no pertenece a esta orden.';
        end if;

        insert into recepcion_items (
            recepcion_id, orden_item_id, cantidad_recibida, cantidad_danada, estado, observacion
        ) values (
            p_id, v_orden_item_id, v_cant_buena, v_cant_danada, v_estado, v_obs
        );

        v_count := v_count + 1;
    end loop;

    if v_count = 0 then
        raise exception '[CONFLICTO] La recepción debe tener al menos un renglón.';
    end if;

    insert into notificaciones (rol_destino, titulo, mensaje, tipo, referencia_id)
    values (
        'compras',
        'Checklist pendiente de revisión',
        'Hay una recepción pendiente de revisar para ' || v_oc.folio || '.',
        'checklist_pendiente',
        p_id
    );

    return p_id;
end;
$$;

create or replace function revisar_recepcion(
    p_recepcion_id uuid,
    p_aprobar boolean,
    p_nota text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol rol_usuario := auth_rol();
    v_uid uuid := auth.uid();
    v_rec recepciones_material%rowtype;
    v_oc ordenes_compra%rowtype;
    r_item record;
    v_hist numeric(12,2);
    v_pedida numeric(12,2);
    v_total_pedida numeric(12,2) := 0;
    v_nuevo_estado estado_orden_compra;
    v_nota text := nullif(trim(coalesce(p_nota, '')), '');
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;
    if v_rol not in ('compras', 'acceso_total') then
        raise exception 'Solo Compras puede revisar recepciones.';
    end if;
    if p_recepcion_id is null or p_aprobar is null then
        raise exception 'Parámetros incompletos.';
    end if;
    if not p_aprobar and (v_nota is null or length(v_nota) = 0) then
        raise exception '[CONFLICTO] Al rechazar debes indicar una nota.';
    end if;

    select * into v_rec
    from recepciones_material
    where id = p_recepcion_id
    for update;

    if not found then
        raise exception '[CONFLICTO] La recepción no existe.';
    end if;
    if v_rec.estado <> 'pendiente_revision' then
        raise exception '[CONFLICTO] Esta recepción ya fue revisada.';
    end if;

    select * into v_oc
    from ordenes_compra
    where id = v_rec.orden_id
    for update;

    if not found then
        raise exception '[CONFLICTO] La orden asociada no existe.';
    end if;
    if v_oc.estado = 'cancelada' then
        raise exception '[CONFLICTO] No se puede revisar una recepción de una OC cancelada.';
    end if;

    if p_aprobar then
        for r_item in
            select ri.orden_item_id, ri.cantidad_recibida, ri.cantidad_danada
            from recepcion_items ri
            where ri.recepcion_id = p_recepcion_id
            for update
        loop
            select oci.cantidad into v_pedida
            from orden_compra_items oci
            where oci.id = r_item.orden_item_id
              and oci.orden_id = v_oc.id
            for update;

            if not found then
                raise exception '[CONFLICTO] Renglón de recepción no pertenece a la OC.';
            end if;

            select coalesce(sum(ri2.cantidad_recibida + ri2.cantidad_danada), 0)
            into v_hist
            from recepcion_items ri2
            join recepciones_material r2 on r2.id = ri2.recepcion_id
            where ri2.orden_item_id = r_item.orden_item_id
              and r2.estado = 'aprobada';

            if v_hist + r_item.cantidad_recibida + r_item.cantidad_danada > v_pedida then
                raise exception
                    '[CONFLICTO] Sobre-recepcion: el renglón excede lo pedido (pedido %, ya aprobado %, intento %).',
                    v_pedida, v_hist, r_item.cantidad_recibida + r_item.cantidad_danada;
            end if;
        end loop;
    end if;

    update recepciones_material
    set
        estado = case when p_aprobar then 'aprobada'::estado_recepcion else 'rechazada'::estado_recepcion end,
        revisado_por = v_uid,
        revisado_en = now(),
        nota_revision = v_nota
    where id = p_recepcion_id;

    if p_aprobar then
        select
            coalesce(sum(oci.cantidad), 0),
            coalesce(sum(coalesce(s.cantidad_cubierta, 0)), 0)
        into v_total_pedida, v_hist
        from orden_compra_items oci
        left join (
            select
                ri.orden_item_id,
                sum(ri.cantidad_recibida + ri.cantidad_danada) as cantidad_cubierta
            from recepcion_items ri
            join recepciones_material r on r.id = ri.recepcion_id
            where r.orden_id = v_oc.id
              and r.estado = 'aprobada'
            group by ri.orden_item_id
        ) s on s.orden_item_id = oci.id
        where oci.orden_id = v_oc.id;

        if v_hist <= 0 then
            v_nuevo_estado := 'emitida';
        elsif v_hist >= v_total_pedida then
            v_nuevo_estado := 'recibida';
        else
            v_nuevo_estado := 'parcialmente_recibida';
        end if;

        if v_oc.estado is distinct from v_nuevo_estado then
            update ordenes_compra
            set estado = v_nuevo_estado
            where id = v_oc.id;
        end if;
    end if;

    insert into notificaciones (usuario_id, titulo, mensaje, tipo, referencia_id)
    values (
        v_rec.receptor_id,
        case when p_aprobar then 'Recepción aprobada' else 'Recepción rechazada' end,
        case
            when p_aprobar then 'Compras aprobó tu checklist de ' || v_oc.folio || '.'
            else 'Compras rechazó tu checklist de ' || v_oc.folio || coalesce(': ' || v_nota, '.')
        end,
        case when p_aprobar then 'recepcion_aprobada' else 'discrepancia_recepcion' end,
        p_recepcion_id
    );
end;
$$;
