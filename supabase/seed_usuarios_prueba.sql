-- =====================================================================
-- Seed de usuarios de prueba (solo desarrollo)
-- Ejecutar en SQL Editor DESPUÉS de la migración 0001.
-- Contraseñas temporales — cambiar antes de producción.
-- =====================================================================
-- Emilio: emilio.prueba@example.com / TempEmilio2026!  → acceso_total
-- Manuel: manuel.prueba@example.com / TempManuel2026!  → proyectos
-- Guero:  guero.prueba@example.com  / TempGuero2026!   → personal
-- Talia:  talia.prueba@example.com  / TempTalia2026!   → compras
-- Blanquita (crear a mano con rol finanzas tras migración 0006a)
-- =====================================================================

do $$
declare
  emilio_id uuid := gen_random_uuid();
  manuel_id uuid := gen_random_uuid();
  guero_id uuid := gen_random_uuid();
  talia_id uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = 'emilio.prueba@example.com') then
    raise notice 'Usuarios base ya existen — se intentan solo personal/compras si faltan.';
  else
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values
    (
      '00000000-0000-0000-0000-000000000000',
      emilio_id,
      'authenticated',
      'authenticated',
      'emilio.prueba@example.com',
      crypt('TempEmilio2026!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nombre":"Emilio"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      manuel_id,
      'authenticated',
      'authenticated',
      'manuel.prueba@example.com',
      crypt('TempManuel2026!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nombre":"Manuel"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values
    (
      gen_random_uuid(), emilio_id,
      jsonb_build_object('sub', emilio_id::text, 'email', 'emilio.prueba@example.com'),
      'email', emilio_id::text, now(), now(), now()
    ),
    (
      gen_random_uuid(), manuel_id,
      jsonb_build_object('sub', manuel_id::text, 'email', 'manuel.prueba@example.com'),
      'email', manuel_id::text, now(), now(), now()
    );

    insert into public.usuarios (id, nombre, rol) values
      (emilio_id, 'Emilio', 'acceso_total'),
      (manuel_id, 'Manuel', 'proyectos');
  end if;

  if not exists (select 1 from auth.users where email = 'guero.prueba@example.com') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values
    (
      '00000000-0000-0000-0000-000000000000',
      guero_id,
      'authenticated',
      'authenticated',
      'guero.prueba@example.com',
      crypt('TempGuero2026!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nombre":"Guero"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      talia_id,
      'authenticated',
      'authenticated',
      'talia.prueba@example.com',
      crypt('TempTalia2026!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nombre":"Talia"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values
    (
      gen_random_uuid(), guero_id,
      jsonb_build_object('sub', guero_id::text, 'email', 'guero.prueba@example.com'),
      'email', guero_id::text, now(), now(), now()
    ),
    (
      gen_random_uuid(), talia_id,
      jsonb_build_object('sub', talia_id::text, 'email', 'talia.prueba@example.com'),
      'email', talia_id::text, now(), now(), now()
    );

    insert into public.usuarios (id, nombre, rol) values
      (guero_id, 'Guero', 'personal'),
      (talia_id, 'Talia', 'compras');
  end if;
end $$;
