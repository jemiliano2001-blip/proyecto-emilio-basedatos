-- Piso de cantidad en topes: al BAJAR obra_material_contratado.cantidad_contratada, el disponible
-- (asignado + entradas - salidas - en proceso - comprado, de v_saldo_material_obra) no puede quedar < 0.
-- Mismo patrón que fn_obras_piso_presupuesto (0029): trigger, para que aplique también por PostgREST.
-- Subir, insertar y borrar no se validan aquí (el borrado con compras es una decisión aparte).
begin;

create or replace function public.fn_obra_material_contratado_piso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_disponible numeric;
begin
    if NEW.cantidad_contratada >= OLD.cantidad_contratada then
        return NEW;
    end if;

    -- Serializa contra reservas/aprobaciones concurrentes del mismo proyecto.
    perform 1 from obras where id = OLD.obra_id for update;

    select cantidad_disponible into v_disponible
      from v_saldo_material_obra
     where obra_id = OLD.obra_id and material_id = OLD.material_id;

    if coalesce(v_disponible, 0) - (OLD.cantidad_contratada - NEW.cantidad_contratada) < 0 then
        raise exception 'La cantidad contratada no puede quedar por debajo de lo ya comprometido y comprado. Lo máximo que puedes quitar es % (disponible actual).',
            greatest(coalesce(v_disponible, 0), 0);
    end if;

    return NEW;
end;
$$;

drop trigger if exists trg_obra_material_contratado_piso on public.obra_material_contratado;
create trigger trg_obra_material_contratado_piso
    before update of cantidad_contratada on public.obra_material_contratado
    for each row execute function public.fn_obra_material_contratado_piso();

revoke all on function public.fn_obra_material_contratado_piso() from public, anon, authenticated;

commit;
