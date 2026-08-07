-- =====================================================================
-- MIGRACIÓN 0010 — Cierre de Obra y Reportes de Conciliación (Fase 7)
-- Permite cerrar formalmente proyectos sin pendientes y genera vistas de
-- conciliación monetaria ($ MXN) y de materiales (cantidades físicas y recepciones).
-- =====================================================================

-- 0. Dónde se guarda la nota de cierre.
-- cerrar_obra() recibía p_nota y la tiraba a la basura: la UI la pide, el
-- script e2e la manda, y no quedaba registrada en ningún lado.
alter table obras
    add column if not exists cierre_nota text;

-- 1. RPC: cerrar_obra
create or replace function cerrar_obra(p_obra_id uuid, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_rol rol_usuario := auth_rol();
    v_obra obras%rowtype;
    v_pendientes_sol numeric;
    v_pendientes_traspas numeric;
    v_pendientes_oc numeric;
    v_pendientes_rec numeric;
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;

    if v_rol not in ('acceso_total', 'operacion') then
        raise exception 'Solo Operación o Acceso Total pueden cerrar proyectos.';
    end if;

    select * into v_obra from obras where id = p_obra_id for update;
    if not found then
        raise exception 'El proyecto no existe.';
    end if;

    if v_obra.estado = 'cerrada' then
        raise exception 'El proyecto ya se encuentra cerrado.';
    end if;

    -- Validar que no haya requisiciones pendientes o en proceso para esta obra
    select count(*) into v_pendientes_sol
    from solicitudes_material s
    left join solicitud_items i on i.solicitud_id = s.id
    where (s.obra_id = p_obra_id or i.obra_id = p_obra_id)
      and s.estado in ('recibida', 'en_proceso', 'pendiente', 'en_cotizacion');

    if v_pendientes_sol > 0 then
        raise exception 'No se puede cerrar la obra porque tiene requisiciones pendientes o en proceso.';
    end if;

    -- Validar que no haya traspasos en tránsito involucrando esta obra
    select count(*) into v_pendientes_traspas
    from traspasos_obra
    where (obra_origen_id = p_obra_id or obra_destino_id = p_obra_id)
      and estado in ('solicitado', 'en_transito');

    if v_pendientes_traspas > 0 then
        raise exception 'No se puede cerrar la obra porque tiene traspasos pendientes o en tránsito.';
    end if;

    -- Órdenes de compra abiertas: material ya pagado que el proveedor todavía
    -- debe entregar. Cerrar aquí dejaría la conciliación cuadrando en papel
    -- contra material que nunca llegó.
    select count(*) into v_pendientes_oc
    from ordenes_compra
    where obra_id = p_obra_id
      and estado in ('emitida', 'parcialmente_recibida');

    if v_pendientes_oc > 0 then
        raise exception 'No se puede cerrar la obra porque tiene órdenes de compra abiertas (pendientes de recibir).';
    end if;

    -- Recepciones capturadas en campo que Compras todavía no revisa.
    select count(*) into v_pendientes_rec
    from recepciones_material r
    join ordenes_compra oc on oc.id = r.orden_id
    where oc.obra_id = p_obra_id
      and r.estado = 'pendiente_revision';

    if v_pendientes_rec > 0 then
        raise exception 'No se puede cerrar la obra porque tiene recepciones pendientes de revisión.';
    end if;

    update obras
    set estado = 'cerrada',
        cerrado_en = now(),
        cierre_nota = p_nota
    where id = p_obra_id;

    insert into notificaciones (rol_destino, titulo, mensaje, tipo, referencia_id)
    values (
        'proyectos',
        'Proyecto cerrado',
        'El proyecto ' || v_obra.nombre || ' ha sido cerrado formalmente.',
        'obra_cerrada',
        p_obra_id
    );
end;
$$;

-- 2. RPC: reabrir_obra
create or replace function reabrir_obra(p_obra_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_rol rol_usuario := auth_rol();
    v_obra obras%rowtype;
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;

    if v_rol <> 'acceso_total' then
        raise exception 'Solo Acceso Total (Emilio) puede reabrir proyectos cerrados.';
    end if;

    select * into v_obra from obras where id = p_obra_id for update;
    if not found then
        raise exception 'El proyecto no existe.';
    end if;

    if v_obra.estado <> 'cerrada' then
        raise exception 'Solo se pueden reabrir proyectos cerrados.';
    end if;

    -- Siempre reabre como 'activa', aunque la obra estuviera 'pausada' antes
    -- de cerrarse: no guardamos el estado previo, y reabrir un proyecto
    -- significa que se va a seguir trabajando en él. Si quedó pausado, se
    -- vuelve a pausar desde la edición del proyecto.
    update obras
    set estado = 'activa',
        cerrado_en = null,
        cierre_nota = null
    where id = p_obra_id;
end;
$$;

revoke all on function public.cerrar_obra(uuid, text) from public, anon;
revoke all on function public.reabrir_obra(uuid) from public, anon;

grant execute on function public.cerrar_obra(uuid, text) to authenticated;
grant execute on function public.reabrir_obra(uuid) to authenticated;

-- 3. Vista de conciliación monetaria ($ MXN) por proyecto
create or replace view v_conciliacion_obra_presupuesto
with (security_invoker = true)
as
select
    o.id as obra_id,
    o.nombre as obra_nombre,
    o.cliente,
    o.fraccionamiento,
    o.paquete,
    o.estado,
    o.presupuesto_mxn,
    o.creado_en,
    o.cerrado_en,
    o.cierre_nota,
    sp.comprometido_mxn as reservado_requisiciones_mxn,
    coalesce((
        select sum(oc.total)
        from ordenes_compra oc
        where oc.obra_id = o.id
          and oc.estado <> 'cancelada'
    ), 0)::numeric(14,2) as gastado_ordenes_compra_mxn,
    coalesce((
        select sum(si.monto_mxn)
        from solicitudes_material s
        join solicitud_items si on si.solicitud_id = s.id
        where coalesce(si.obra_id, s.obra_id) = o.id
          and s.estado in ('en_proceso', 'finalizada')
          and si.tipo_linea in ('flete', 'camiones')
    ), 0)::numeric(14,2) as fletes_camiones_mxn,
    coalesce((
        select sum(si.monto_mxn)
        from solicitudes_material s
        join solicitud_items si on si.solicitud_id = s.id
        where coalesce(si.obra_id, s.obra_id) = o.id
          and s.estado in ('en_proceso', 'finalizada')
          and si.tipo_linea in ('mantenimiento', 'otro')
    ), 0)::numeric(14,2) as servicios_otros_mxn,
    -- Dinero movido por traspasos completados (Fase 6): lo que esta obra
    -- recuperó al ceder material, y lo que absorbió al recibirlo.
    coalesce(sp.traspasos_credito_mxn, 0)::numeric(14,2) as traspasos_credito_mxn,
    coalesce(sp.traspasos_cargo_mxn, 0)::numeric(14,2) as traspasos_cargo_mxn,
    (
        coalesce((
            select sum(oc.total)
            from ordenes_compra oc
            where oc.obra_id = o.id
              and oc.estado <> 'cancelada'
        ), 0)
        + coalesce((
            select sum(si.monto_mxn)
            from solicitudes_material s
            join solicitud_items si on si.solicitud_id = s.id
            where coalesce(si.obra_id, s.obra_id) = o.id
              and s.estado in ('en_proceso', 'finalizada')
              and si.tipo_linea <> 'material'
        ), 0)
        + coalesce(sp.traspasos_cargo_mxn, 0)
        - coalesce(sp.traspasos_credito_mxn, 0)
    )::numeric(14,2) as gastado_total_ejecutado_mxn,
    (
        o.presupuesto_mxn - (
            coalesce((
                select sum(oc.total)
                from ordenes_compra oc
                where oc.obra_id = o.id
                  and oc.estado <> 'cancelada'
            ), 0)
            + coalesce((
                select sum(si.monto_mxn)
                from solicitudes_material s
                join solicitud_items si on si.solicitud_id = s.id
                where coalesce(si.obra_id, s.obra_id) = o.id
                  and s.estado in ('en_proceso', 'finalizada')
                  and si.tipo_linea <> 'material'
            ), 0)
            + coalesce(sp.traspasos_cargo_mxn, 0)
            - coalesce(sp.traspasos_credito_mxn, 0)
        )
    )::numeric(14,2) as variacion_saldo_mxn
from obras o
left join v_saldo_presupuesto_obra sp on sp.obra_id = o.id
-- Esta vista es 100% dinero (presupuesto, gastado, desviación). `personal` no
-- ve precios en ninguna otra parte del sistema — mismo criterio que
-- puedeVerPrecios() en lib/roles.ts. El gate de la pantalla no basta: sin esto
-- cualquiera con la anon key puede leerla directo por PostgREST.
where auth_rol() in ('acceso_total', 'compras', 'finanzas', 'operacion', 'proyectos');

grant select on v_conciliacion_obra_presupuesto to authenticated;

-- 4. Vista de conciliación de materiales (cantidades físicas) por proyecto y material
create or replace view v_conciliacion_obra_material
with (security_invoker = true)
as
select
    sm.obra_id,
    sm.material_id,
    sm.nombre_base,
    sm.variante,
    sm.unidad_medida,
    cm.categoria,
    cm.subcategoria,
    sm.cantidad_contratada,
    sm.traspasos_entrada,
    sm.traspasos_salida,
    (sm.cantidad_contratada + sm.traspasos_entrada - sm.traspasos_salida)::numeric(12,2) as cantidad_tope_efectiva,
    sm.cantidad_usada,
    sm.cantidad_comprometida,
    sm.cantidad_disponible,
    coalesce((
        select sum(ri.cantidad_recibida)
        from recepcion_items ri
        join recepciones_material r on r.id = ri.recepcion_id
        join ordenes_compra oc on oc.id = r.orden_id
        join orden_compra_items oci on oci.id = ri.orden_item_id
        where oc.obra_id = sm.obra_id
          and oci.material_id = sm.material_id
          and r.estado = 'aprobada'
    ), 0)::numeric(12,2) as cantidad_recibida_buena_sitio,
    case
        when (sm.cantidad_contratada + sm.traspasos_entrada - sm.traspasos_salida) > 0
        then round(
            ((sm.cantidad_usada + sm.cantidad_comprometida) / (sm.cantidad_contratada + sm.traspasos_entrada - sm.traspasos_salida)) * 100,
            2
        )
        else 0
    end as porcentaje_ejecucion
from v_saldo_material_obra sm
join catalogo_materiales cm on cm.id = sm.material_id;

grant select on v_conciliacion_obra_material to authenticated;
