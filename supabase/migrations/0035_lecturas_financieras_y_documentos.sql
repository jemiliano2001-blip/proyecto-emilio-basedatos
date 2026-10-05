-- Lecturas enmascaradas y documentos privados. Aplicar junto con 0034.
begin;

-- authenticated es compartido por todos los roles de negocio. Los importes
-- no pueden concederse directamente a ese rol; solo las vistas los devuelven
-- después de verificar el perfil activo. Las vistas no admiten escrituras.
do $$
declare r record; cols text; visible text;
begin
  for r in select * from (values
    ('catalogo_materiales','precio_base','catalogo_materiales_lectura','auth_rol() is not null'),
    ('obras','presupuesto_mxn','obras_lectura','puede_acceder_obra(id)'),
    ('solicitud_items','monto_mxn','solicitud_items_lectura','puede_leer_solicitud(solicitud_id)')
  ) x(tabla, importe, vista, filtro) loop
    select string_agg(format('%I',attname),', ' order by attnum),
      string_agg(case when attname = r.importe then format(
        'case when auth_rol() in (''compras'',''finanzas'',''proyectos'',''operacion'',''acceso_total'') then %I else null end as %I',attname,attname)
        else format('%I',attname) end, ', ' order by attnum)
    into cols,visible from pg_attribute where attrelid = ('public.'||r.tabla)::regclass and attnum > 0 and not attisdropped;
    execute format('create or replace view public.%I with (security_barrier=true) as select %s from public.%I where %s',r.vista,visible,r.tabla,r.filtro);
    execute format('revoke all on public.%I from public, anon, authenticated',r.vista);
    execute format('grant select on public.%I to authenticated',r.vista);
    execute format('revoke select on public.%I from public, anon, authenticated',r.tabla);
    execute format('revoke select (%s) on public.%I from public, anon, authenticated',cols,r.tabla);
    select string_agg(format('%I',attname),', ' order by attnum) into cols
      from pg_attribute where attrelid = ('public.'||r.tabla)::regclass and attnum > 0 and not attisdropped and attname <> r.importe;
    execute format('grant select (%s) on public.%I to authenticated',cols,r.tabla);
  end loop;
end $$;
create policy importes_oficina on public.obra_presupuesto_movimientos as restrictive for select to authenticated
  using(auth_rol() in ('compras','finanzas','proyectos','operacion','acceso_total'));

-- Cantidades agregadas de todo el proyecto, incluso si otra persona recibió.
-- Owner intencional: evita depender de acceso a precios/OC de Personal.
-- El filtro explícito reemplaza el alcance del invocador y no expone dinero.
do $$ declare n text; d text; begin
  foreach n in array array['v_saldo_material_obra','v_inventario_campo_obra','v_conciliacion_obra_material'] loop
    d := regexp_replace(pg_get_viewdef(('public.'||n)::regclass,true),';[[:space:]]*$','');
    execute format('create or replace view public.%I with (security_invoker=false,security_barrier=true) as select * from (%s) scoped where puede_acceder_obra(scoped.obra_id)',n,d);
    execute format('revoke all on public.%I from public,anon,authenticated',n);
    execute format('grant select on public.%I to authenticated',n);
  end loop;
end $$;
-- Estas vistas auxiliares se consumen exclusivamente desde RPC con autorización.
revoke all on public.v_recepciones_lista, public.v_orden_item_saldo_recepcion from public,anon,authenticated;

-- Personal consulta documentos operativos de proyectos asignados. Finanzas
-- y el resto de oficina pueden consultar también presupuesto/conciliación.
create policy alcance_documentos on public.obra_documentos as restrictive for all to authenticated
  using(puede_acceder_obra(obra_id) and (auth_rol() <> 'personal' or tipo_documento not in ('presupuesto','conciliacion')))
  with check(puede_acceder_obra(obra_id) and auth_rol() in ('compras','finanzas','proyectos','operacion','acceso_total'));
update storage.buckets set public=false where id='obra-documentos';
drop policy if exists "Documentos Obra - Acceso Publico / Autenticado de Lectura" on storage.objects;
drop policy if exists "Documentos Obra - Subida por Oficina" on storage.objects;
drop policy if exists "Documentos Obra - Eliminacion por Oficina" on storage.objects;
create policy documentos_lectura_autorizada on storage.objects for select to authenticated
  using(bucket_id='obra-documentos' and exists(select 1 from public.obra_documentos d where d.archivo_path = name));
create function public.puede_subir_documento(p_path text) returns boolean
language plpgsql stable security definer set search_path=public as $$
begin
  if auth_rol() is null or auth_rol() not in ('compras','finanzas','proyectos','operacion','acceso_total') then return false; end if;
  if split_part(p_path,'/',1) <> 'obras' or split_part(p_path,'/',3) = '' then return false; end if;
  return exists(select 1 from obras o where o.id = split_part(p_path,'/',2)::uuid and puede_acceder_obra(o.id));
exception when invalid_text_representation then return false;
end $$;
revoke all on function public.puede_subir_documento(text) from public,anon;
grant execute on function public.puede_subir_documento(text) to authenticated;
create policy documentos_subida_oficina on storage.objects for insert to authenticated
  with check(bucket_id='obra-documentos' and puede_subir_documento(name));
create policy documentos_borrado_oficina on storage.objects for delete to authenticated
  using(bucket_id='obra-documentos' and auth_rol() in ('operacion','proyectos','acceso_total') and puede_subir_documento(name));
notify pgrst,'reload schema';
commit;
