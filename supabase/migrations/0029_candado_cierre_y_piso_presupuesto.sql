-- =====================================================================
-- MIGRACIÓN 0029 — Candado de cierre en topes + piso de presupuesto
--
-- Problema 1: cerrar un proyecto "congela saldos" solo en la UI. Las policies
-- tope_update / tope_delete de obra_material_contratado validan el rol, nunca
-- obras.estado, así que un PATCH/DELETE directo (o la UI antes del fix) podía
-- cambiar o borrar topes de un proyecto cerrado después de la conciliación final.
--
-- Problema 2: editar_proyecto (0016) solo exige presupuesto_mxn >= 0; se podía
-- bajar el presupuesto por debajo de lo ya comprometido + gastado y dejar
-- disponible_mxn negativo sin aviso.
--
-- Mismo patrón que fn_solicitudes_material_before_update (0007) y
-- fn_traspasos_obra_before_update (0009): la regla vive en un trigger para que
-- aplique pase por donde pase el cambio (RPC, server action o PostgREST directo).
--
-- Aplica también a acceso_total: para corregir un proyecto cerrado se reabre con
-- reabrir_obra (0010), se corrige y se vuelve a cerrar, dejando rastro.
-- =====================================================================

begin;

-- 1. Topes de un proyecto cerrado son de solo lectura -----------------------
create or replace function public.fn_obra_material_contratado_candado_cierre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_obra_id uuid := case when tg_op = 'DELETE' then OLD.obra_id else NEW.obra_id end;
    v_estado text;
begin
    select estado into v_estado from obras where id = v_obra_id;
    -- Sin fila (p. ej. borrado en cascada de la obra) no hay nada que proteger.
    if v_estado = 'cerrada' then
        raise exception 'El proyecto está cerrado: sus materiales ya no se pueden modificar. Reábrelo primero.';
    end if;
    if tg_op = 'UPDATE' and NEW.obra_id is distinct from OLD.obra_id then
        raise exception 'No se puede mover un tope a otro proyecto.';
    end if;
    return case when tg_op = 'DELETE' then OLD else NEW end;
end;
$$;

drop trigger if exists trg_obra_material_contratado_candado_cierre on public.obra_material_contratado;
create trigger trg_obra_material_contratado_candado_cierre
    before insert or update or delete on public.obra_material_contratado
    for each row execute function public.fn_obra_material_contratado_candado_cierre();

-- 2. Presupuesto: congelado al cerrar y nunca por debajo de lo usado --------
create or replace function public.fn_obras_piso_presupuesto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_usado numeric(14,2);
begin
    if NEW.presupuesto_mxn is not distinct from OLD.presupuesto_mxn then
        return NEW;
    end if;

    if OLD.estado = 'cerrada' then
        raise exception 'El proyecto está cerrado: su presupuesto ya no se puede modificar. Reábrelo primero.';
    end if;

    -- Solo se valida al bajar: subir el presupuesto (p. ej. asignar_materiales_proyecto)
    -- nunca puede dejar el saldo negativo.
    if NEW.presupuesto_mxn < OLD.presupuesto_mxn then
        select coalesce(comprometido_mxn, 0) + coalesce(gastado_mxn, 0)
          into v_usado
          from v_saldo_presupuesto_obra
         where obra_id = OLD.id;

        if NEW.presupuesto_mxn < coalesce(v_usado, 0) then
            raise exception 'El presupuesto no puede quedar por debajo de lo ya comprometido y gastado (%).',
                to_char(v_usado, 'FM$999,999,999,990.00');
        end if;
    end if;

    return NEW;
end;
$$;

drop trigger if exists trg_obras_piso_presupuesto on public.obras;
create trigger trg_obras_piso_presupuesto
    before update of presupuesto_mxn on public.obras
    for each row execute function public.fn_obras_piso_presupuesto();

commit;
