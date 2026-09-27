-- =====================================================================
-- MIGRACIÓN 0032 — Finanzas puede consultar recepciones (solo lectura)
--
-- Problema: lib/roles.ts (puedeVerRecepciones) y el menú le muestran "Recepción" a
-- Finanzas, pero las RPC listar_recepciones y detalle_recepcion la rechazaban
-- ("Sin permiso" / "No autorizado"): la lista salía vacía y el detalle en 404.
-- Decisión (2026-09-27): Finanzas SÍ ve recepciones, sin capturar ni revisar.
--
-- Por qué no se copia el cuerpo de las funciones: en el remoto detalle_recepcion
-- sigue en la versión previa a 0019 (0019 no está aplicada: no existe
-- recepcion_fotos). Copiar la versión de 0019 rompería el detalle. En su lugar se
-- toma la definición VIVA y solo se agrega 'finanzas' a la lista de roles, así que
-- sirve con cualquier versión. Es idempotente.
--
-- OJO: si después se aplica 0019 (u otra que redefina estas funciones), vuelve a
-- correr esta migración, porque esa redefinición trae la lista de roles sin finanzas.
-- crear_recepcion y revisar_recepcion NO cambian.
-- =====================================================================

do $$
declare
    v_def text;
begin
    v_def := pg_get_functiondef('public.listar_recepciones()'::regprocedure);
    if position('''finanzas''' in v_def) = 0 then
        v_def := replace(
            v_def,
            'elsif v_rol in (''compras'', ''operacion'', ''proyectos'', ''acceso_total'')',
            'elsif v_rol in (''compras'', ''operacion'', ''proyectos'', ''finanzas'', ''acceso_total'')'
        );
        if position('''finanzas''' in v_def) = 0 then
            raise exception 'listar_recepciones: no se encontró la lista de roles esperada; revisar a mano.';
        end if;
        execute v_def;
    end if;

    v_def := pg_get_functiondef('public.detalle_recepcion(uuid)'::regprocedure);
    if position('''finanzas''' in v_def) = 0 then
        v_def := replace(
            v_def,
            'auth_rol() in (''personal'', ''compras'', ''proyectos'', ''operacion'', ''acceso_total'')',
            'auth_rol() in (''personal'', ''compras'', ''proyectos'', ''operacion'', ''finanzas'', ''acceso_total'')'
        );
        if position('''finanzas''' in v_def) = 0 then
            raise exception 'detalle_recepcion: no se encontró la lista de roles esperada; revisar a mano.';
        end if;
        execute v_def;
    end if;
end;
$$;
