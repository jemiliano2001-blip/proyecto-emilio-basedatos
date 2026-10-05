-- Materiales y servicios requieren proveedor y cotización antes de reservar/pagar.
begin;
do $$ declare d text; marker text := '-- Validar y reservar cantidad (materiales)'; guard text; begin
  d := pg_get_functiondef('public.aprobar_solicitud_compras(uuid,jsonb)'::regprocedure);
  if position(marker in d)=0 or position('proveedor_id = coalesce' in d)=0 then
    raise exception 'Verificar que la definición de 0027 esté instalada antes de 0038.';
  end if;
  guard := $guard$
    if exists(select 1 from solicitud_items si where si.solicitud_id=p_solicitud_id
      and (si.proveedor_id is null or not exists(select 1 from proveedores p where p.id=si.proveedor_id and p.activo))) then
      raise exception 'Asigna un proveedor activo a cada partida, incluidos servicios.';
    end if;
    if exists(select 1 from solicitud_items si where si.solicitud_id=p_solicitud_id
      and si.tipo_linea <> 'material' and coalesce(si.monto_mxn,0) <= 0) then
      raise exception 'Captura el importe cotizado en todos los servicios.';
    end if;
  $guard$;
  execute replace(d,marker,guard || E'\n' || marker);
  d := pg_get_functiondef('public.aprobar_pago_solicitud(uuid)'::regprocedure);
  marker := '-- Liberar + gastar la reserva pendiente por obra (incluye materiales)';
  if position(marker in d)=0 then raise exception 'Verificar definición de pago de 0027 antes de 0038.'; end if;
  -- También cubre requisiciones antiguas que ya estaban en Finanzas.
  execute replace(d,marker,guard || E'\n' || marker);
end $$;
notify pgrst,'reload schema';
commit;
