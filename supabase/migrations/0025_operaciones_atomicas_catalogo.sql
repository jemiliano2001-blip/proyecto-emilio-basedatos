-- =====================================================================
-- MIGRACIÓN 0025 — Integridad de operaciones compuestas y catálogo
-- Mantiene en una sola transacción los kits y las asignaciones masivas.
-- También impide que un material apunte a una categoría inexistente.
-- =====================================================================

begin;

create or replace function public.validar_componentes_kit(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_material_id uuid;
  v_cantidad numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'Los componentes del kit son inválidos.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    group by item.value->>'material_id'
    having count(*) > 1
  ) then
    raise exception 'Un material no puede repetirse dentro del kit.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_material_id := (v_item->>'material_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::numeric;
    if v_cantidad is null or v_cantidad <= 0 or v_cantidad > 9999999999.99 then
      raise exception 'Cantidad de componente inválida.';
    end if;
    perform 1 from catalogo_materiales where id = v_material_id and activo for share;
    if not found then
      raise exception 'El material del componente no está disponible.';
    end if;
  end loop;
end;
$$;

create or replace function public.crear_kit_con_items(p_datos jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_principal uuid;
begin
  if auth.uid() is null or auth_rol() not in ('proyectos', 'operacion', 'acceso_total') then
    raise exception 'No tienes permiso para gestionar kits de materiales.';
  end if;
  if length(trim(coalesce(p_datos->>'nombre', ''))) not between 2 and 200 then
    raise exception 'Nombre de kit inválido.';
  end if;
  perform validar_componentes_kit(p_items);

  v_principal := nullif(p_datos->>'material_principal_id', '')::uuid;
  if v_principal is not null and not exists (
    select 1 from catalogo_materiales where id = v_principal and activo
  ) then
    raise exception 'El material principal no está disponible.';
  end if;

  insert into material_kits(nombre, material_principal_id, configuracion, descripcion, activo)
  values (
    trim(p_datos->>'nombre'),
    v_principal,
    nullif(trim(coalesce(p_datos->>'configuracion', '')), ''),
    nullif(trim(coalesce(p_datos->>'descripcion', '')), ''),
    coalesce((p_datos->>'activo')::boolean, true)
  ) returning id into v_id;

  insert into material_kit_items(kit_id, material_id, cantidad)
  select v_id, (value->>'material_id')::uuid, (value->>'cantidad')::numeric
  from jsonb_array_elements(p_items);
  return v_id;
end;
$$;

create or replace function public.actualizar_kit_con_items(p_kit_id uuid, p_datos jsonb, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_principal uuid;
begin
  if auth.uid() is null or auth_rol() not in ('proyectos', 'operacion', 'acceso_total') then
    raise exception 'No tienes permiso para gestionar kits de materiales.';
  end if;
  if length(trim(coalesce(p_datos->>'nombre', ''))) not between 2 and 200 then
    raise exception 'Nombre de kit inválido.';
  end if;
  perform 1 from material_kits where id = p_kit_id for update;
  if not found then raise exception 'El kit no existe.'; end if;
  perform validar_componentes_kit(p_items);

  v_principal := nullif(p_datos->>'material_principal_id', '')::uuid;
  if v_principal is not null and not exists (
    select 1 from catalogo_materiales where id = v_principal and activo
  ) then
    raise exception 'El material principal no está disponible.';
  end if;

  update material_kits set
    nombre = trim(p_datos->>'nombre'),
    material_principal_id = v_principal,
    configuracion = nullif(trim(coalesce(p_datos->>'configuracion', '')), ''),
    descripcion = nullif(trim(coalesce(p_datos->>'descripcion', '')), ''),
    activo = coalesce((p_datos->>'activo')::boolean, true)
  where id = p_kit_id;

  delete from material_kit_items where kit_id = p_kit_id;
  insert into material_kit_items(kit_id, material_id, cantidad)
  select p_kit_id, (value->>'material_id')::uuid, (value->>'cantidad')::numeric
  from jsonb_array_elements(p_items);
end;
$$;

create or replace function public.asignar_materiales_proyecto(p_obra_id uuid, p_partidas jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_material_id uuid;
  v_cantidad numeric;
  v_precio numeric;
  v_costo_total numeric := 0;
begin
  if auth.uid() is null or auth_rol() not in ('proyectos', 'operacion', 'acceso_total') then
    raise exception 'No tienes permiso para asignar materiales al proyecto.';
  end if;
  if p_partidas is null or jsonb_typeof(p_partidas) <> 'array' or jsonb_array_length(p_partidas) = 0 or jsonb_array_length(p_partidas) > 1000 then
    raise exception 'Las partidas asignadas son inválidas.';
  end if;
  perform 1 from obras where id = p_obra_id and estado <> 'cerrada' for update;
  if not found then raise exception 'El proyecto no está disponible para asignaciones.'; end if;

  for v_item in select value from jsonb_array_elements(p_partidas) loop
    v_material_id := (v_item->>'material_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::numeric;
    if v_cantidad is null or v_cantidad <= 0 or v_cantidad > 9999999999.99 then
      raise exception 'Cantidad de material inválida.';
    end if;
    select precio_base into v_precio from catalogo_materiales
      where id = v_material_id and activo for share;
    if not found then raise exception 'El material no está disponible.'; end if;

    insert into obra_material_contratado(obra_id, material_id, cantidad_contratada)
    values (p_obra_id, v_material_id, v_cantidad)
    on conflict (obra_id, material_id) do update
      set cantidad_contratada = obra_material_contratado.cantidad_contratada + excluded.cantidad_contratada;
    v_costo_total := v_costo_total + (v_cantidad * coalesce(v_precio, 0));
  end loop;

  if v_costo_total > 0 then
    update obras
      set presupuesto_mxn = presupuesto_mxn + round(v_costo_total, 2)
      where id = p_obra_id;
  end if;
end;
$$;

create or replace function public.validar_categoria_material()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_categoria_id uuid;
begin
  new.categoria := nullif(trim(coalesce(new.categoria, '')), '');
  new.subcategoria := nullif(trim(coalesce(new.subcategoria, '')), '');
  if new.categoria is null and new.subcategoria is not null then
    raise exception 'Selecciona una categoría antes de la subcategoría.';
  end if;
  if new.categoria is null then return new; end if;

  select id into v_categoria_id from material_categorias where nombre = new.categoria;
  if v_categoria_id is null then raise exception 'La categoría seleccionada no existe.'; end if;
  if new.subcategoria is not null and not exists (
    select 1 from material_subcategorias
    where categoria_id = v_categoria_id and nombre = new.subcategoria
  ) then
    raise exception 'La subcategoría no pertenece a la categoría seleccionada.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_categoria_material on public.catalogo_materiales;
create trigger trg_validar_categoria_material
before insert or update of categoria, subcategoria on public.catalogo_materiales
for each row execute function public.validar_categoria_material();

revoke all on function public.validar_componentes_kit(jsonb) from public, anon, authenticated;
revoke all on function public.validar_categoria_material() from public, anon, authenticated;
revoke all on function public.crear_kit_con_items(jsonb, jsonb) from public, anon;
revoke all on function public.actualizar_kit_con_items(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.asignar_materiales_proyecto(uuid, jsonb) from public, anon;
grant execute on function public.crear_kit_con_items(jsonb, jsonb) to authenticated;
grant execute on function public.actualizar_kit_con_items(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.asignar_materiales_proyecto(uuid, jsonb) to authenticated;

commit;
