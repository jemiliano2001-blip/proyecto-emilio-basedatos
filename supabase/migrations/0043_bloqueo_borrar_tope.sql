-- No se puede borrar el tope de un material que ya tiene movimientos en el proyecto: la vista de saldos
-- arma su universo desde obra_material_contratado, así que el borrado lo haría desaparecer del detalle,
-- la conciliación y el Excel aunque ya haya dinero gastado. Para reducirlo se baja la cantidad hasta lo
-- comprometido (piso de 0042). Cuenta como movimiento: solicitud no rechazada/cancelada, reserva
-- activa/aplicada, orden de compra no cancelada, traspaso no rechazado/cancelado o instalación reportada.
-- El borrado en cascada de un proyecto (la fila de obras ya no existe) no se bloquea.
begin;

create or replace function public.fn_obra_material_contratado_bloqueo_borrado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_nombre text;
begin
    if not exists (select 1 from obras where id = OLD.obra_id) then
        return OLD;
    end if;

    if exists (
            select 1 from solicitud_items si
            join solicitudes_material sm on sm.id = si.solicitud_id
            where si.material_id = OLD.material_id
              and coalesce(si.obra_id, sm.obra_id) = OLD.obra_id
              and sm.estado::text not in ('rechazada', 'cancelada'))
        or exists (
            select 1 from solicitud_reservas_cantidad r
            where r.obra_id = OLD.obra_id and r.material_id = OLD.material_id
              and r.estado in ('activa', 'aplicada'))
        or exists (
            select 1 from orden_compra_items oci
            join ordenes_compra oc on oc.id = oci.orden_id
            where oci.material_id = OLD.material_id and oc.obra_id = OLD.obra_id
              and oc.estado::text <> 'cancelada')
        or exists (
            select 1 from traspaso_items ti
            join traspasos_obra t on t.id = ti.traspaso_id
            where ti.material_id = OLD.material_id
              and OLD.obra_id in (t.obra_origen_id, t.obra_destino_id)
              and t.estado not in ('rechazado', 'cancelado'))
        or exists (
            select 1 from obra_material_instalaciones i
            where i.obra_id = OLD.obra_id and i.material_id = OLD.material_id)
    then
        select nombre_base into v_nombre from catalogo_materiales where id = OLD.material_id;
        raise exception 'No se puede quitar "%": ya tiene movimientos en este proyecto (solicitudes, compras, traspasos o instalaciones). Baja la cantidad contratada hasta lo comprometido en lugar de borrarlo.',
            coalesce(v_nombre, 'este material');
    end if;

    return OLD;
end;
$$;

drop trigger if exists trg_obra_material_contratado_bloqueo_borrado on public.obra_material_contratado;
create trigger trg_obra_material_contratado_bloqueo_borrado
    before delete on public.obra_material_contratado
    for each row execute function public.fn_obra_material_contratado_bloqueo_borrado();

revoke all on function public.fn_obra_material_contratado_bloqueo_borrado() from public, anon, authenticated;

commit;
