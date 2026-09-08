-- PENDIENTE DE REVISIÓN Y APLICACIÓN. Aplicar antes del frontend de este lote.
begin;

create or replace function public.auth_rol()
returns rol_usuario language sql stable security definer set search_path = public as $$
  select rol from public.usuarios where id = auth.uid() and activo = true;
$$;
revoke all on function public.auth_rol() from public, anon;
grant execute on function public.auth_rol() to authenticated;

-- La edición normal no puede cerrar/reabrir ni alterar fechas o notas de cierre.
-- Las RPC SECURITY DEFINER existentes conservan los permisos de su propietario.
revoke update on public.obras from public, anon, authenticated;
revoke update(estado,cerrado_en,cierre_nota) on public.obras from public, anon, authenticated;
grant update (nombre, cliente, ciudad, fraccionamiento, paquete, ubicacion, presupuesto_mxn)
  on public.obras to authenticated;

create or replace function public.editar_proyecto(p_id uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_estado text; v_presupuesto numeric;
begin
  if auth.uid() is null or auth_rol() is null or auth_rol() not in ('operacion', 'acceso_total') then
    raise exception 'No tienes permiso para editar proyectos.';
  end if;
  select estado into v_estado from obras where id = p_id for update;
  if not found then raise exception 'El proyecto no existe.'; end if;
  if v_estado = 'cerrada' then raise exception 'Reabre el proyecto antes de editarlo.'; end if;
  if p_datos->>'estado' is null or p_datos->>'estado' not in ('activa','pausada') then
    raise exception 'Usa el cierre formal del proyecto.';
  end if;
  if length(trim(coalesce(p_datos->>'nombre',''))) not between 2 and 200 then
    raise exception 'Nombre de proyecto inválido.';
  end if;
  v_presupuesto := (p_datos->>'presupuesto_mxn')::numeric;
  if v_presupuesto is null or v_presupuesto < 0 or v_presupuesto > 999999999999.99 then
    raise exception 'Presupuesto inválido.';
  end if;
  update obras set nombre = trim(p_datos->>'nombre'), cliente = p_datos->>'cliente',
    ciudad = p_datos->>'ciudad', fraccionamiento = p_datos->>'fraccionamiento',
    paquete = p_datos->>'paquete', ubicacion = p_datos->>'ubicacion',
    estado = p_datos->>'estado', presupuesto_mxn = v_presupuesto where id = p_id;
end; $$;
revoke all on function public.editar_proyecto(uuid,jsonb) from public, anon;
grant execute on function public.editar_proyecto(uuid,jsonb) to authenticated;

-- Una sola transacción: no quedan proyectos huérfanos si falla un material.
create or replace function public.crear_proyecto_con_presupuesto(p_datos jsonb, p_topes jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_presupuesto numeric; v_item jsonb; v_precio numeric;
begin
  if auth.uid() is null or auth_rol() is null or auth_rol() not in ('operacion','acceso_total') then
    raise exception 'No tienes permiso para crear proyectos.';
  end if;
  if p_datos->>'estado' is null or p_datos->>'estado' not in ('activa','pausada') then
    raise exception 'Un nuevo proyecto debe estar activo o pausado.';
  end if;
  if length(trim(coalesce(p_datos->>'nombre',''))) not between 2 and 200 then
    raise exception 'Nombre de proyecto inválido.';
  end if;
  if p_topes is null or jsonb_typeof(p_topes) <> 'array' or jsonb_array_length(p_topes) > 1000 then
    raise exception 'Presupuesto de materiales inválido.';
  end if;
  v_presupuesto := (p_datos->>'presupuesto_mxn')::numeric;
  if v_presupuesto is null or v_presupuesto < 0 or v_presupuesto > 999999999999.99 then
    raise exception 'Presupuesto inválido.';
  end if;
  for v_item in select value from jsonb_array_elements(p_topes) loop
    if (v_item->>'cantidad_contratada')::numeric is null or (v_item->>'cantidad_contratada')::numeric <= 0 then
      raise exception 'Cantidad de material inválida.';
    end if;
    select precio_base into v_precio from catalogo_materiales
      where id = (v_item->>'material_id')::uuid and activo for share;
    if not found then raise exception 'El material no está disponible.'; end if;
  end loop;
  if v_presupuesto = 0 and jsonb_array_length(p_topes) > 0 then
    select round(sum((t.value->>'cantidad_contratada')::numeric * coalesce(m.precio_base,0)),2)
      into v_presupuesto from jsonb_array_elements(p_topes) t
      join catalogo_materiales m on m.id = (t.value->>'material_id')::uuid;
  end if;
  insert into obras(nombre,cliente,ciudad,fraccionamiento,paquete,ubicacion,estado,presupuesto_mxn)
    values(trim(p_datos->>'nombre'),p_datos->>'cliente',p_datos->>'ciudad',p_datos->>'fraccionamiento',
      p_datos->>'paquete',p_datos->>'ubicacion',p_datos->>'estado',v_presupuesto) returning id into v_id;
  insert into obra_material_contratado(obra_id,material_id,cantidad_contratada)
    select v_id,(value->>'material_id')::uuid,(value->>'cantidad_contratada')::numeric
    from jsonb_array_elements(p_topes);
  return v_id;
end; $$;
revoke all on function public.crear_proyecto_con_presupuesto(jsonb,jsonb) from public, anon;
grant execute on function public.crear_proyecto_con_presupuesto(jsonb,jsonb) to authenticated;

-- Evita también INSERT directo de proyectos ya cerrados o con metadatos de cierre.
drop policy if exists obras_insert on public.obras;
create policy obras_insert on public.obras for insert to authenticated with check (
  auth_rol() in ('acceso_total','operacion') and estado in ('activa','pausada')
  and cerrado_en is null and cierre_nota is null
);

-- Campos operativos legibles; precios únicamente mediante RPC con rol financiero.
revoke select on public.traspaso_items from public, anon, authenticated;
grant select(id,traspaso_id,material_id,cantidad) on public.traspaso_items to authenticated;
create or replace function public.precios_traspaso(p_traspaso_id uuid)
returns table(id uuid, precio_unitario_mxn numeric)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth_rol() is null or auth_rol() not in
    ('acceso_total','compras','finanzas','operacion','proyectos') then
    raise exception 'No tienes permiso para consultar precios.';
  end if;
  return query select ti.id, ti.precio_unitario_mxn from traspaso_items ti
    where ti.traspaso_id = p_traspaso_id;
end; $$;
revoke all on function public.precios_traspaso(uuid) from public, anon;
grant execute on function public.precios_traspaso(uuid) to authenticated;

-- Las vistas invoker financieras también usan el precio protegido. Exponerlas
-- por RPC mantiene su cálculo intacto y valida el rol antes de leer columnas.
create or replace function public.saldo_presupuesto_proyecto(p_obra_id uuid)
returns setof public.v_saldo_presupuesto_obra
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth_rol() is null or auth_rol() not in
    ('acceso_total','compras','finanzas','operacion','proyectos') then
    raise exception 'No tienes permiso para consultar presupuestos.';
  end if;
  return query select * from public.v_saldo_presupuesto_obra where obra_id = p_obra_id;
end; $$;
create or replace function public.conciliacion_presupuesto_proyecto(p_obra_id uuid)
returns setof public.v_conciliacion_obra_presupuesto
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth_rol() is null or auth_rol() not in
    ('acceso_total','compras','finanzas','operacion','proyectos') then
    raise exception 'No tienes permiso para consultar presupuestos.';
  end if;
  return query select * from public.v_conciliacion_obra_presupuesto where obra_id = p_obra_id;
end; $$;
revoke all on function public.saldo_presupuesto_proyecto(uuid) from public, anon;
revoke all on function public.conciliacion_presupuesto_proyecto(uuid) from public, anon;
grant execute on function public.saldo_presupuesto_proyecto(uuid) to authenticated;
grant execute on function public.conciliacion_presupuesto_proyecto(uuid) to authenticated;

alter function public.fn_notificaciones_solo_leida() set search_path = public;
commit;
