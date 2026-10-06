-- Renombrar/eliminar categorías y subcategorías junto con sus materiales en UNA transacción.
-- catalogo_materiales las referencia por nombre (sin FK): hacerlo en dos pasos desde la app dejaba
-- materiales huérfanos o sin categoría si fallaba el segundo. Cada RPC devuelve cuántos materiales tocó.
begin;

create function public.renombrar_categoria_material(p_id uuid, p_nombre text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_nombre text := trim(coalesce(p_nombre, '')); v_actual text; v_n integer;
begin
  if auth_rol() is null or auth_rol() not in ('proyectos','acceso_total') then raise exception 'Sin permiso para gestionar categorías.'; end if;
  if v_nombre = '' then raise exception 'El nombre de la categoría no puede estar vacío.'; end if;
  select nombre into v_actual from material_categorias where id = p_id for update;
  if not found then raise exception 'La categoría no existe.'; end if;
  if v_actual = v_nombre then return 0; end if;
  update material_categorias set nombre = v_nombre where id = p_id;
  update catalogo_materiales set categoria = v_nombre where categoria = v_actual;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create function public.eliminar_categoria_material(p_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_actual text; v_n integer;
begin
  if auth_rol() is null or auth_rol() not in ('proyectos','acceso_total') then raise exception 'Sin permiso para gestionar categorías.'; end if;
  select nombre into v_actual from material_categorias where id = p_id for update;
  if not found then raise exception 'La categoría no existe.'; end if;
  update catalogo_materiales set categoria = null, subcategoria = null where categoria = v_actual;
  get diagnostics v_n = row_count;
  delete from material_categorias where id = p_id;
  return v_n;
end $$;

create function public.renombrar_subcategoria_material(p_id uuid, p_nombre text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_nombre text := trim(coalesce(p_nombre, '')); v_actual text; v_categoria text; v_n integer;
begin
  if auth_rol() is null or auth_rol() not in ('proyectos','acceso_total') then raise exception 'Sin permiso para gestionar subcategorías.'; end if;
  if v_nombre = '' then raise exception 'El nombre de la subcategoría no puede estar vacío.'; end if;
  select s.nombre, c.nombre into v_actual, v_categoria
    from material_subcategorias s join material_categorias c on c.id = s.categoria_id
    where s.id = p_id for update of s;
  if not found then raise exception 'La subcategoría no existe.'; end if;
  if v_actual = v_nombre then return 0; end if;
  update material_subcategorias set nombre = v_nombre where id = p_id;
  update catalogo_materiales set subcategoria = v_nombre where categoria = v_categoria and subcategoria = v_actual;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create function public.eliminar_subcategoria_material(p_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_actual text; v_categoria text; v_n integer;
begin
  if auth_rol() is null or auth_rol() not in ('proyectos','acceso_total') then raise exception 'Sin permiso para gestionar subcategorías.'; end if;
  select s.nombre, c.nombre into v_actual, v_categoria
    from material_subcategorias s join material_categorias c on c.id = s.categoria_id
    where s.id = p_id for update of s;
  if not found then raise exception 'La subcategoría no existe.'; end if;
  update catalogo_materiales set subcategoria = null where categoria = v_categoria and subcategoria = v_actual;
  get diagnostics v_n = row_count;
  delete from material_subcategorias where id = p_id;
  return v_n;
end $$;

revoke all on function public.renombrar_categoria_material(uuid,text) from public, anon;
revoke all on function public.eliminar_categoria_material(uuid) from public, anon;
revoke all on function public.renombrar_subcategoria_material(uuid,text) from public, anon;
revoke all on function public.eliminar_subcategoria_material(uuid) from public, anon;
grant execute on function public.renombrar_categoria_material(uuid,text) to authenticated;
grant execute on function public.eliminar_categoria_material(uuid) to authenticated;
grant execute on function public.renombrar_subcategoria_material(uuid,text) to authenticated;
grant execute on function public.eliminar_subcategoria_material(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
