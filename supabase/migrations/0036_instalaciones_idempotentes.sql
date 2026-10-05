-- Mismo ID en cada reintento; no duplica cantidad al perderse una respuesta.
begin;
drop function public.reportar_instalacion_material(uuid,uuid,numeric,text);
create function public.reportar_instalacion_material(
  p_obra_id uuid, p_material_id uuid, p_cantidad numeric,
  p_nota text default null, p_id uuid default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid := auth.uid();
  v_rol rol_usuario := auth_rol();
  v_id uuid := coalesce(p_id,gen_random_uuid());
  v_cantidad numeric := round(p_cantidad,2);
  v_nota text := nullif(trim(coalesce(p_nota,'')),'');
  v_pendiente numeric;
  v_existente obra_material_instalaciones%rowtype;
begin
  if v_uid is null or v_rol is null then raise exception 'No autenticado.'; end if;
  if v_rol not in ('personal','operacion','proyectos','acceso_total') or not puede_acceder_obra(p_obra_id) then
    raise exception 'Sin permiso para reportar instalaciones en este proyecto.';
  end if;
  if v_cantidad is null or v_cantidad <= 0 or length(coalesce(v_nota,'')) > 2000 then raise exception 'Cantidad o nota no válida.'; end if;
  -- Serializa todas las instalaciones del proyecto, incluidas solicitudes concurrentes.
  perform 1 from obras where id=p_obra_id for update;
  if not found then raise exception 'El proyecto no existe.'; end if;
  select * into v_existente from obra_material_instalaciones where id=v_id;
  if found then
    if v_existente.reportado_por = v_uid and v_existente.obra_id = p_obra_id
       and v_existente.material_id = p_material_id and v_existente.cantidad = v_cantidad
       and v_existente.nota is not distinct from v_nota then return v_id; end if;
    raise exception '[CONFLICTO] Ese ID de instalación ya tiene otro contenido.';
  end if;
  if not exists(select 1 from obras where id=p_obra_id and estado='activa') then
    raise exception '[CONFLICTO] Solo se pueden reportar instalaciones en proyectos activos.';
  end if;
  select cantidad_pendiente_instalar into v_pendiente from v_inventario_campo_obra where obra_id=p_obra_id and material_id=p_material_id;
  if v_pendiente is null then raise exception '[CONFLICTO] No hay material recibido para instalar.'; end if;
  if v_cantidad > v_pendiente then raise exception '[CONFLICTO] La cantidad supera lo pendiente de instalar (%).',v_pendiente; end if;
  insert into obra_material_instalaciones(id,obra_id,material_id,cantidad,nota,reportado_por)
    values(v_id,p_obra_id,p_material_id,v_cantidad,v_nota,v_uid);
  return v_id;
end $$;
revoke all on function public.reportar_instalacion_material(uuid,uuid,numeric,text,uuid) from public,anon;
grant execute on function public.reportar_instalacion_material(uuid,uuid,numeric,text,uuid) to authenticated;
-- La escritura directa evitaría el cálculo de stock y la serialización.
revoke insert,update,delete on public.obra_material_instalaciones from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
