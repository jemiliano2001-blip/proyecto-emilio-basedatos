-- =====================================================================
-- MIGRACIÓN 0030 — Máquina de estados de ordenes_compra
--
-- Problema: la policy ordenes_compra_update (0014) solo dice QUIÉN escribe
-- (compras, finanzas, acceso_total), no QUÉ. Por PostgREST directo se podía
-- marcar una OC como 'recibida' sin recepciones aprobadas, cambiar su total o
-- dejarla sin proveedor (lo que la vuelve irrecibible: detalle_orden_checklist
-- hace join con proveedores).
--
-- Mismo patrón que fn_solicitudes_material_before_update (0007) y
-- fn_traspasos_obra_before_update (0009).
--
-- Reglas (todos menos acceso_total):
--  * Inmutables: folio, obra_id, solicitud_id, cotizacion_id, total, moneda,
--    creado_por, creado_en. Nacen en aprobar_pago_solicitud y no se editan.
--  * proveedor_id se puede cambiar (asignarProveedorOrdenAction) pero no vaciar.
--  * folio_fisico es libre.
--  * estado: entre emitida / parcialmente_recibida / recibida solo se permite el
--    estado que corresponde a las recepciones aprobadas — la misma fórmula que usa
--    revisar_recepcion (0005b), así esa RPC sigue funcionando y un PATCH directo
--    no puede inventar una recepción. 'cancelada' (entrar o salir) queda solo para
--    acceso_total: hoy ninguna pantalla cancela OCs.
-- =====================================================================

begin;

create or replace function public.fn_ordenes_compra_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_total_pedida numeric;
    v_hist numeric;
    v_esperado estado_orden_compra;
begin
    if auth_rol() = 'acceso_total' then
        return NEW;
    end if;

    if NEW.folio is distinct from OLD.folio
       or NEW.obra_id is distinct from OLD.obra_id
       or NEW.solicitud_id is distinct from OLD.solicitud_id
       or NEW.cotizacion_id is distinct from OLD.cotizacion_id
       or NEW.total is distinct from OLD.total
       or NEW.moneda is distinct from OLD.moneda
       or NEW.creado_por is distinct from OLD.creado_por
       or NEW.creado_en is distinct from OLD.creado_en then
        raise exception 'No se pueden modificar folio, proyecto, requisición, total, moneda ni fecha de una orden de compra.';
    end if;

    if NEW.proveedor_id is null and OLD.proveedor_id is not null then
        raise exception 'Una orden de compra no puede quedar sin proveedor.';
    end if;

    if NEW.estado is not distinct from OLD.estado then
        return NEW;
    end if;

    if 'cancelada' in (OLD.estado, NEW.estado) then
        raise exception 'Solo acceso total puede cancelar o reactivar una orden de compra.';
    end if;

    -- Misma fórmula que revisar_recepcion (0005b).
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
        where r.orden_id = OLD.id
          and r.estado = 'aprobada'
        group by ri.orden_item_id
    ) s on s.orden_item_id = oci.id
    where oci.orden_id = OLD.id;

    if v_hist <= 0 then
        v_esperado := 'emitida';
    elsif v_hist >= v_total_pedida then
        v_esperado := 'recibida';
    else
        v_esperado := 'parcialmente_recibida';
    end if;

    if NEW.estado is distinct from v_esperado then
        raise exception 'El estado de la orden lo determinan sus recepciones aprobadas (corresponde: %).', v_esperado;
    end if;

    return NEW;
end;
$$;

drop trigger if exists trg_ordenes_compra_before_update on public.ordenes_compra;
create trigger trg_ordenes_compra_before_update
    before update on public.ordenes_compra
    for each row execute function public.fn_ordenes_compra_before_update();

commit;
