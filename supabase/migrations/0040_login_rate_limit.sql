-- Límite de intentos de login compartido entre instancias serverless.
-- La app manda solo el SHA-256 de la clave (ip+correo o ip); aquí nunca hay correos ni IPs en claro.
-- Ventana fija de 15 min desde el primer fallo. El umbral lo decide la app.
begin;

create table public.login_intentos (
  clave_hash     text primary key check (clave_hash ~ '^[0-9a-f]{64}$'),
  fallos         integer not null check (fallos > 0),
  ventana_inicio timestamptz not null default now()
);
alter table public.login_intentos enable row level security;
revoke all on public.login_intentos from public, anon, authenticated;

create function public.login_segundos_bloqueo(p_clave text, p_max integer)
returns integer language sql security definer set search_path = public stable as $$
  select coalesce((
    select ceil(extract(epoch from ventana_inicio + interval '15 minutes' - now()))::integer
    from public.login_intentos
    where clave_hash = p_clave
      and fallos >= p_max
      and ventana_inicio + interval '15 minutes' > now()
  ), 0);
$$;

create function public.login_registrar_fallo(p_clave text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_clave is null or p_clave !~ '^[0-9a-f]{64}$' then raise exception 'Clave no válida.'; end if;
  delete from public.login_intentos where ventana_inicio < now() - interval '1 day';
  insert into public.login_intentos as li (clave_hash, fallos, ventana_inicio)
  values (p_clave, 1, now())
  on conflict (clave_hash) do update set
    fallos = case when li.ventana_inicio + interval '15 minutes' <= now() then 1 else li.fallos + 1 end,
    ventana_inicio = case when li.ventana_inicio + interval '15 minutes' <= now() then now() else li.ventana_inicio end;
end $$;

create function public.login_limpiar(p_clave text)
returns void language sql security definer set search_path = public as $$
  delete from public.login_intentos where clave_hash = p_clave;
$$;

-- El login ocurre antes de autenticar: se ejecutan como anon (y authenticated por sesiones ya abiertas).
revoke all on function public.login_segundos_bloqueo(text,integer) from public;
revoke all on function public.login_registrar_fallo(text) from public;
revoke all on function public.login_limpiar(text) from public;
grant execute on function public.login_segundos_bloqueo(text,integer) to anon, authenticated;
grant execute on function public.login_registrar_fallo(text) to anon, authenticated;
grant execute on function public.login_limpiar(text) to anon, authenticated;

notify pgrst,'reload schema';
commit;
