-- Personal: varios proyectos explícitamente asignados. Sin asignaciones implícitas.
-- Revisar y aplicar antes de publicar las lecturas que dependen de esta migración.
begin;

create table public.usuario_obras (
  id uuid not null default gen_random_uuid() unique,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  asignado_por uuid not null references public.usuarios(id),
  creado_en timestamptz not null default now(),
  primary key(usuario_id, obra_id)
);
alter table public.usuario_obras enable row level security;
create policy usuario_obras_select on public.usuario_obras for select to authenticated
  using (auth_rol() = 'acceso_total' or (auth_rol() = 'personal' and usuario_id = auth.uid()));
create policy usuario_obras_insert on public.usuario_obras for insert to authenticated
  with check (auth_rol() = 'acceso_total' and asignado_por = auth.uid());
create policy usuario_obras_delete on public.usuario_obras for delete to authenticated
  using (auth_rol() = 'acceso_total');
revoke all on public.usuario_obras from public, anon, authenticated;
grant select on public.usuario_obras to authenticated;
create trigger trg_auditoria_usuario_obras after insert or update or delete on public.usuario_obras
  for each row execute function public.fn_auditoria();

create function public.puede_acceder_obra(p_obra_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and auth_rol() is not null and p_obra_id is not null
    and (auth_rol() <> 'personal' or exists (
      select 1 from usuario_obras a where a.usuario_id = auth.uid() and a.obra_id = p_obra_id
    ));
$$;
create function public.puede_acceder_orden(p_orden_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from ordenes_compra oc where oc.id = p_orden_id and puede_acceder_obra(oc.obra_id));
$$;
create function public.puede_leer_solicitud(p_solicitud_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from solicitudes_material sm where sm.id = p_solicitud_id
    and puede_acceder_obra(sm.obra_id)
    and (auth_rol() <> 'personal' or sm.solicitante_id = auth.uid()));
$$;
create function public.asignar_proyectos_usuario(p_usuario_id uuid, p_obra_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth_rol() is distinct from 'acceso_total' then
    raise exception 'Solo Acceso Total puede asignar proyectos.';
  end if;
  perform 1 from usuarios where id = p_usuario_id and rol = 'personal' for update;
  if not found then raise exception 'La asignación de proyectos corresponde a Personal.'; end if;
  if p_obra_ids is null or cardinality(p_obra_ids) > 500
     or exists(select 1 from unnest(p_obra_ids) e(obra_id) where e.obra_id is null)
     or exists(select 1 from unnest(p_obra_ids) e(obra_id) where not exists(select 1 from obras o where o.id = e.obra_id)) then
    raise exception 'La lista de proyectos no es válida.';
  end if;
  -- El reemplazo es atómico y auditado; una entrada inválida no borra asignaciones.
  delete from usuario_obras where usuario_id = p_usuario_id and not (obra_id = any(p_obra_ids));
  insert into usuario_obras(usuario_id,obra_id,asignado_por)
    select distinct p_usuario_id,e.obra_id,auth.uid() from unnest(p_obra_ids) e(obra_id) on conflict do nothing;
end;
$$;
revoke all on function public.puede_acceder_obra(uuid), public.puede_acceder_orden(uuid),
  public.puede_leer_solicitud(uuid), public.asignar_proyectos_usuario(uuid,uuid[]) from public, anon;
grant execute on function public.puede_acceder_obra(uuid), public.puede_acceder_orden(uuid),
  public.puede_leer_solicitud(uuid), public.asignar_proyectos_usuario(uuid,uuid[]) to authenticated;

-- Restrictivas: nunca amplían las policies existentes y también cubren PATCH directo.
create policy alcance_obra on public.obras as restrictive for all to authenticated
  using(puede_acceder_obra(id)) with check(puede_acceder_obra(id));
create policy alcance_topes on public.obra_material_contratado as restrictive for all to authenticated
  using(puede_acceder_obra(obra_id)) with check(puede_acceder_obra(obra_id));
create policy alcance_solicitud on public.solicitudes_material as restrictive for all to authenticated
  using(puede_acceder_obra(obra_id)) with check(puede_acceder_obra(obra_id));
create policy alcance_items on public.solicitud_items as restrictive for all to authenticated
  using(puede_leer_solicitud(solicitud_id)) with check(puede_leer_solicitud(solicitud_id));
create policy alcance_reservas on public.solicitud_reservas_cantidad as restrictive for all to authenticated
  using(puede_acceder_obra(obra_id)) with check(puede_acceder_obra(obra_id));
create policy alcance_recepcion on public.recepciones_material as restrictive for all to authenticated
  using(puede_acceder_orden(orden_id)) with check(puede_acceder_orden(orden_id));
create policy alcance_instalaciones on public.obra_material_instalaciones as restrictive for all to authenticated
  using(puede_acceder_obra(obra_id)) with check(puede_acceder_obra(obra_id));
create policy alcance_traspasos on public.traspasos_obra as restrictive for all to authenticated
  using(puede_acceder_obra(obra_origen_id) or puede_acceder_obra(obra_destino_id))
  with check(puede_acceder_obra(obra_origen_id) and puede_acceder_obra(obra_destino_id));

-- Toda tabla pública con RLS rechaza sesiones de perfiles inactivos.
-- auth_rol es SECURITY DEFINER y consulta usuarios sin recursión de policy.
do $$ declare t record; begin
  for t in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r' and c.relrowsecurity loop
    execute format('create policy perfil_activo on public.%I as restrictive for all to authenticated using (auth_rol() is not null) with check (auth_rol() is not null)',t.relname);
  end loop;
end $$;

-- Las RPC definer validan el alcance explícitamente: no dependen de RLS.
-- Conserva las definiciones instaladas (con/sin fotografías) y sus reglas financieras.
do $$
declare r record; d text; pos integer; head text;
begin
  for r in select * from (values
    ('public.crear_solicitud_con_items(uuid,text,jsonb,uuid)', $guard$
      if not puede_acceder_obra(p_obra_id) then raise exception 'Sin permiso para este proyecto.'; end if;
      if jsonb_typeof(p_items) = 'array' and exists(select 1 from jsonb_array_elements(p_items) i
        where not puede_acceder_obra(coalesce(nullif(i->>'obra_id','')::uuid,p_obra_id))) then
        raise exception 'Sin permiso para un proyecto de la requisición.';
      end if;
    $guard$),
    ('public.detalle_recepcion(uuid)', $guard$
      if auth.uid() is null or auth_rol() is null then raise exception 'No autenticado.'; end if;
      if exists(select 1 from recepciones_material r where r.id = p_recepcion_id
        and (not puede_acceder_orden(r.orden_id) or (auth_rol() = 'personal' and r.receptor_id <> auth.uid()))) then
        raise exception 'Sin permiso para ver esta recepción.';
      end if;
    $guard$),
    ('public.detalle_orden_checklist(uuid)', $guard$
      if not puede_acceder_orden(p_orden_id) then raise exception 'Sin permiso para esta orden.'; end if;
    $guard$),
    ('public.crear_recepcion(uuid,uuid,text,text,timestamp with time zone,jsonb)', $guard$
      if not puede_acceder_orden(p_orden_id) then raise exception 'Sin permiso para esta orden.'; end if;
    $guard$),
    ('public.reportar_instalacion_material(uuid,uuid,numeric,text)', $guard$
      if not puede_acceder_obra(p_obra_id) then raise exception 'Sin permiso para este proyecto.'; end if;
      perform 1 from obras where id = p_obra_id and estado = 'activa' for update;
      if not found then raise exception 'Solo se pueden reportar instalaciones en proyectos activos.'; end if;
    $guard$),
    ('public.crear_solicitud_traspaso(uuid,uuid,text,jsonb)', $guard$
      if not puede_acceder_obra(p_obra_origen_id) or not puede_acceder_obra(p_obra_destino_id) then
        raise exception 'Sin permiso para los proyectos del traspaso.';
      end if;
    $guard$),
    ('public.confirmar_recepcion_traspaso(uuid)', $guard$
      if not exists(select 1 from traspasos_obra t where t.id = p_traspaso_id and puede_acceder_obra(t.obra_destino_id)) then
        raise exception 'Sin permiso para recibir en el proyecto destino.';
      end if;
    $guard$),
    ('public.cancelar_traspaso(uuid)', $guard$
      if not exists(select 1 from traspasos_obra t where t.id=p_traspaso_id and puede_acceder_obra(t.obra_origen_id)) then
        raise exception 'Sin permiso para cancelar en el proyecto origen.';
      end if;
    $guard$),
    ('public.cancelar_solicitud(uuid)', $guard$
      if not puede_leer_solicitud(p_solicitud_id) then raise exception 'Sin permiso para esta requisición.'; end if;
    $guard$)
  ) x(signature,guard) loop
    if to_regprocedure(r.signature) is null then raise exception 'Falta RPC necesaria: %',r.signature; end if;
    d := pg_get_functiondef(to_regprocedure(r.signature));
    -- 0019 pendiente puede haberse aplicado justo antes; conserva el permiso
    -- de lectura de Finanzas acordado en 0032, además de las guardas nuevas.
    if r.signature='public.detalle_recepcion(uuid)' and position('''finanzas''' in d)=0 then
      d := replace(d,
        'auth_rol() in (''personal'', ''compras'', ''proyectos'', ''operacion'', ''acceso_total'')',
        'auth_rol() in (''personal'', ''compras'', ''proyectos'', ''operacion'', ''finanzas'', ''acceso_total'')');
      if position('''finanzas''' in d)=0 then raise exception 'No se reconoce la lista de roles de detalle_recepcion.'; end if;
    end if;
    head := (regexp_match(d,'(?im)^[[:blank:]]*begin[[:blank:]]*\r?\n'))[1];
    if head is null then raise exception 'No se reconoce el cuerpo de %',r.signature; end if;
    pos := position(head in d);
    d := overlay(d placing E'\nbegin\n' || r.guard from pos for char_length(head));
    execute d;
  end loop;
  d := pg_get_functiondef('public.listar_ordenes_checklist()'::regprocedure);
  d := replace(d, 'where oc.estado in', 'where puede_acceder_obra(oc.obra_id) and oc.estado in');
  if position('puede_acceder_obra(oc.obra_id)' in d) = 0 then raise exception 'Revisar listar_ordenes_checklist.'; end if;
  execute d;
  d := pg_get_functiondef('public.listar_recepciones()'::regprocedure);
  d := replace(d, 'where v.receptor_id = v_uid', 'where v.receptor_id = v_uid and puede_acceder_orden(v.orden_id)');
  if position('puede_acceder_orden(v.orden_id)' in d) = 0 then raise exception 'Revisar listar_recepciones.'; end if;
  execute d;
end $$;

-- Una sesión revocada no puede usar las RPC definer aunque conserve su JWT.
-- Incluye funciones históricas cuyo NOT IN no rechazaba auth_rol() NULL.
do $$ declare r record; d text; head text; pos integer; begin
  for r in select p.oid from pg_proc p join pg_language l on l.oid=p.prolang
    where p.pronamespace='public'::regnamespace and p.prosecdef and l.lanname='plpgsql'
      and p.prorettype <> 'trigger'::regtype and has_function_privilege('authenticated',p.oid,'EXECUTE') loop
    d := pg_get_functiondef(r.oid);
    head := (regexp_match(d,'(?im)^[[:blank:]]*begin[[:blank:]]*\r?\n'))[1];
    if head is null then raise exception 'No se reconoce la RPC %',r.oid::regprocedure; end if;
    pos := position(head in d);
    execute overlay(d placing E'\nbegin\n if auth.uid() is null or auth_rol() is null then raise exception ''No autenticado.''; end if;\n' from pos for char_length(head));
  end loop;
end $$;

-- Evita metadatos de fotos de proyectos ajenos cuando 0019 esté instalada.
do $$ begin
  if to_regclass('public.recepcion_fotos') is not null then
    execute 'create policy alcance_fotos on public.recepcion_fotos as restrictive for all to authenticated
      using (exists(select 1 from recepciones_material r where r.id = recepcion_id))
      with check (exists(select 1 from recepciones_material r where r.id = recepcion_id))';
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
