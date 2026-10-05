-- Requiere 0019 ANTES de 0034: la redefinición antigua de detalle no debe
-- sobrescribir las guardas nuevas. La aplicación no ignora errores de evidencia.
begin;
do $$ begin
  if to_regclass('public.recepcion_fotos') is null then raise exception 'Aplicar 0019 antes del conjunto 0034-0038.'; end if;
end $$;
create or replace function public.guardar_evidencias_recepcion(p_recepcion_id uuid,p_fotos jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare r recepciones_material%rowtype; f jsonb; item_id uuid; material uuid; tipo tipo_foto_evidencia;
begin
  if auth.uid() is null or auth_rol() is null or auth_rol() not in ('personal','compras','acceso_total') then raise exception 'Sin permiso para guardar evidencia.'; end if;
  select * into r from recepciones_material where id=p_recepcion_id for update;
  if not found or not puede_acceder_orden(r.orden_id) or (r.receptor_id <> auth.uid() and auth_rol() <> 'acceso_total') then raise exception 'Sin permiso para esta recepción.'; end if;
  if r.estado <> 'pendiente_revision' then raise exception 'La recepción ya fue revisada. No se puede cambiar su evidencia.'; end if;
  if p_fotos is null or jsonb_typeof(p_fotos) <> 'array' then raise exception 'Evidencias no válidas.'; end if;
  if jsonb_array_length(p_fotos) > 200 then raise exception 'Demasiadas evidencias.'; end if;
  for f in select value from jsonb_array_elements(p_fotos) loop
    if coalesce(f->>'foto_url','') = '' or coalesce(f->>'storage_path','') not like 'recepciones/%' then raise exception 'Fotografía no válida.'; end if;
    tipo := (f->>'tipo_foto')::tipo_foto_evidencia;
    item_id := null; material := null;
    if nullif(f->>'orden_item_id','') is not null then
      select ri.id,oci.material_id into item_id,material from recepcion_items ri join orden_compra_items oci on oci.id=ri.orden_item_id
        where ri.recepcion_id=p_recepcion_id and ri.orden_item_id=(f->>'orden_item_id')::uuid;
      if not found then raise exception 'La evidencia no pertenece al checklist.'; end if;
    end if;
    if not exists(select 1 from recepcion_fotos where recepcion_id=p_recepcion_id and storage_path=f->>'storage_path') then
      insert into recepcion_fotos(recepcion_id,recepcion_item_id,material_id,tipo_foto,storage_path,foto_url,capturado_por,latitud,longitud,precision_gps_m,calidad_score,resolucion_px)
      values(p_recepcion_id,item_id,material,tipo,f->>'storage_path',f->>'foto_url',auth.uid(),
        nullif(f->>'latitud','')::numeric,nullif(f->>'longitud','')::numeric,nullif(f->>'precision_gps_m','')::numeric,nullif(f->>'calidad_score','')::numeric,f->>'resolucion_px');
    end if;
    if tipo = 'remision_documento' then update recepciones_material set foto_remision_url=f->>'foto_url' where id=p_recepcion_id;
    elsif tipo = 'material_completo' and item_id is null then update recepciones_material set foto_evidencia_url=f->>'foto_url' where id=p_recepcion_id; end if;
    if item_id is not null then update recepcion_items set foto_url=f->>'foto_url' where id=item_id; end if;
  end loop;
end $$;
revoke all on function public.guardar_evidencias_recepcion(uuid,jsonb) from public,anon;
grant execute on function public.guardar_evidencias_recepcion(uuid,jsonb) to authenticated;
revoke insert,update,delete on public.recepcion_fotos from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
