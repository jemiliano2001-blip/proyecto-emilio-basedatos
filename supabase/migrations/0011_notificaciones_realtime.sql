-- Realtime + marcar leídas las notificaciones de broadcast por rol.
-- Con un usuario por rol (Talía, Blanquita) eso es correcto.
-- Si más adelante hay 2+ personas en el mismo rol, hay que pasar a
-- lecturas por usuario (tabla notificacion_lecturas). No lo inventamos ahora.
--
-- La policy de UPDATE deja escribir a quien ve la fila; el trigger
-- fn_notificaciones_solo_leida impide cambiar cualquier columna que no
-- sea `leida` (título, destinatario, referencia, etc.).

drop policy if exists notificaciones_update on notificaciones;

create policy notificaciones_update on notificaciones for update
    using (
        usuario_id = auth.uid()
        or rol_destino = auth_rol()
    )
    with check (
        usuario_id = auth.uid()
        or rol_destino = auth_rol()
    );

create or replace function public.fn_notificaciones_solo_leida()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.usuario_id is distinct from old.usuario_id
     or new.rol_destino is distinct from old.rol_destino
     or new.titulo is distinct from old.titulo
     or new.mensaje is distinct from old.mensaje
     or new.tipo is distinct from old.tipo
     or new.referencia_id is distinct from old.referencia_id
     or new.creado_en is distinct from old.creado_en
  then
    raise exception 'Solo se puede marcar una notificación como leída.';
  end if;
  return new;
end;
$$;

revoke all on function public.fn_notificaciones_solo_leida() from public;
revoke all on function public.fn_notificaciones_solo_leida() from anon;
revoke all on function public.fn_notificaciones_solo_leida() from authenticated;

drop trigger if exists trg_notificaciones_solo_leida on notificaciones;
create trigger trg_notificaciones_solo_leida
    before update on notificaciones
    for each row execute function fn_notificaciones_solo_leida();

alter table notificaciones replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notificaciones'
  ) then
    alter publication supabase_realtime add table notificaciones;
  end if;
end $$;

comment on policy notificaciones_update on notificaciones is
  'Marcar leida: propia o broadcast del rol. Un usuario por rol; si hay varios, cambiar a lecturas por usuario. El trigger impide cambiar columnas distintas de leida.';
