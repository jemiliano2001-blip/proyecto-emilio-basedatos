-- =====================================================================
-- MIGRACIÓN 0017 — Creación atómica de requisiciones con items y notificaciones
-- Encapsula en una sola transacción PostgreSQL la validación de saldos,
-- creación de cabecera, inserción de renglones y notificación a compras.
-- =====================================================================

begin;

create or replace function public.crear_solicitud_con_items(
  p_obra_id uuid,
  p_nota text,
  p_items jsonb,
  p_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rol rol_usuario := auth_rol();
  v_solicitud_id uuid;
  v_obra_estado text;
  v_item jsonb;
  v_tipo text;
  v_mat_id uuid;
  v_item_obra_id uuid;
  v_cant numeric;
  v_desc text;
  v_monto numeric;
  v_nota text;
  v_solicitante_nombre text;
  v_disponible numeric;
  v_mat_nombre text;
begin
  -- 1. Autenticación y rol
  if v_uid is null or v_rol is null then
    raise exception 'No autenticado.';
  end if;
  if v_rol not in ('personal', 'compras', 'acceso_total') then
    raise exception 'No tienes permiso para levantar requisiciones.';
  end if;

  -- 2. Validar obra base
  select estado into v_obra_estado from public.obras where id = p_obra_id;
  if not found then
    raise exception 'El proyecto seleccionado no existe.';
  end if;
  if v_obra_estado <> 'activa' then
    raise exception 'Solo puedes solicitar para proyectos activos.';
  end if;

  -- 3. Validar items
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La requisición debe tener al menos un renglón.';
  end if;
  if jsonb_array_length(p_items) > 500 then
    raise exception 'Demasiados renglones en una requisición.';
  end if;

  -- 4. Validar multi-obra si aplica
  for v_item in select value from jsonb_array_elements(p_items) loop
    if v_item->>'obra_id' is not null and v_rol not in ('compras', 'acceso_total') then
      raise exception 'No tienes permiso para requisiciones multi-obra.';
    end if;
  end loop;

  -- 5. Validar materiales y saldos disponibles
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_tipo := coalesce(v_item->>'tipo_linea', 'material');
    if v_tipo = 'material' then
      v_mat_id := nullif(v_item->>'material_id', '')::uuid;
      v_item_obra_id := coalesce(nullif(v_item->>'obra_id', '')::uuid, p_obra_id);
      v_cant := nullif(v_item->>'cantidad_solicitada', '')::numeric;

      if v_mat_id is null or v_cant is null or v_cant <= 0 then
        raise exception 'Datos de material inválidos en un renglón.';
      end if;

      select nombre_base into v_mat_nombre from public.catalogo_materiales where id = v_mat_id and activo;
      if not found then
        raise exception 'Uno o más materiales no están activos o no existen.';
      end if;

      -- Verificar saldo en vista v_saldo_material_obra
      select cantidad_disponible into v_disponible
        from public.v_saldo_material_obra
        where obra_id = v_item_obra_id and material_id = v_mat_id;

      if not found then
        raise exception 'El material "%" no tiene presupuesto asignado en este proyecto.', v_mat_nombre;
      end if;

      if v_disponible is null or v_disponible < v_cant then
        raise exception 'Saldo insuficiente: Para "%" solicitas %, pero solo hay % disponible.',
          v_mat_nombre, v_cant, coalesce(v_disponible, 0);
      end if;
    end if;
  end loop;

  -- 6. Insertar cabecera (idempotente si se provee p_id)
  v_solicitud_id := coalesce(p_id, gen_random_uuid());
  insert into public.solicitudes_material (
    id, obra_id, solicitante_id, estado, nota
  ) values (
    v_solicitud_id, p_obra_id, v_uid, 'recibida', trim(p_nota)
  );

  -- 7. Insertar renglones
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_tipo := coalesce(v_item->>'tipo_linea', 'material');
    v_mat_id := nullif(v_item->>'material_id', '')::uuid;
    v_cant := nullif(v_item->>'cantidad_solicitada', '')::numeric;
    v_desc := trim(v_item->>'descripcion');
    v_monto := nullif(v_item->>'monto_mxn', '')::numeric;
    v_nota := trim(v_item->>'nota');
    v_item_obra_id := nullif(v_item->>'obra_id', '')::uuid;

    insert into public.solicitud_items (
      solicitud_id, tipo_linea, material_id, cantidad_solicitada,
      descripcion, monto_mxn, nota, obra_id
    ) values (
      v_solicitud_id, v_tipo::tipo_linea_solicitud, v_mat_id, v_cant,
      v_desc, v_monto, v_nota, v_item_obra_id
    );
  end loop;

  -- 8. Notificación a compras
  select nombre into v_solicitante_nombre from public.usuarios where id = v_uid;
  insert into public.notificaciones (
    rol_destino, titulo, mensaje, tipo, referencia_id
  ) values (
    'compras',
    'Nueva requisición',
    coalesce(v_solicitante_nombre, 'Un usuario') || ' levantó una requisición con ' || jsonb_array_length(p_items)::text || ' renglón(es).',
    'solicitud_nueva',
    v_solicitud_id
  );

  return v_solicitud_id;
end;
$$;

revoke all on function public.crear_solicitud_con_items(uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.crear_solicitud_con_items(uuid, text, jsonb, uuid) to authenticated;

commit;
