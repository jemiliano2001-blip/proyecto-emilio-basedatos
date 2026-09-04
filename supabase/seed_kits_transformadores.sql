-- =====================================================================
-- SEED: Materiales de Transformadores, Chiquitiaje y Kits Compuestos
-- =====================================================================

-- 1. MATERIALES PRINCIPALES (Transformadores)
insert into catalogo_materiales (nombre_base, variante, unidad_medida, categoria, subcategoria, precio_base, activo)
values
    ('TRANSFORMADOR 100 KVA', '13.2 kV / 220-127 V', 'PZA', 'Electromecánico', 'Transformadores', 85000.00, true),
    ('TRANSFORMADOR 75 KVA', '13.2 kV / 220-127 V', 'PZA', 'Electromecánico', 'Transformadores', 68000.00, true),
    ('TRANSFORMADOR 50 KVA', '13.2 kV / 220-127 V', 'PZA', 'Electromecánico', 'Transformadores', 52000.00, true),
    ('TRANSFORMADOR 25 KVA', '13.2 kV / 220-127 V', 'PZA', 'Electromecánico', 'Transformadores', 38000.00, true)
on conflict (nombre_base, variante) do update
set precio_base = excluded.precio_base,
    categoria = excluded.categoria,
    subcategoria = excluded.subcategoria;

-- 2. COMPONENTES MENORES ("Chiquitiaje", Herrajes, Cableado, Accesorios)
insert into catalogo_materiales (nombre_base, variante, unidad_medida, categoria, subcategoria, precio_base, activo)
values
    ('CINCHOS DE FIJACIÓN INOXIDABLE', '3/4 pulg x 100 ft', 'PZA', 'Electromecánico', 'Accesorios subterráneos', 450.00, true),
    ('CABLE DE COBRE DESNUDO 2/0 AWG', 'Temple suave', 'MTS', 'Electromecánico', 'Cableado', 280.00, true),
    ('HERRAJES Y SOPORTE PARA TRANSFORMADOR', 'Estándar tipo CFE', 'JGO', 'Electromecánico', 'Accesorios aéreos (herrajes)', 4200.00, true),
    ('CONECTOR TIPO CODO OCC 200 A', '15 kV', 'PZA', 'Electromecánico', 'Accesorios subterráneos', 1850.00, true),
    ('CORTACIRCUITOS FUSIBLE 15 KV', '100 A / 110 kV NBAI', 'PZA', 'Electromecánico', 'Accesorios aéreos (herrajes)', 2400.00, true),
    ('APARTARRAYOS DE POLÍMERO 12 KV', 'Distribución Media Tensión', 'PZA', 'Electromecánico', 'Accesorios aéreos (herrajes)', 1950.00, true)
on conflict (nombre_base, variante) do update
set precio_base = excluded.precio_base,
    categoria = excluded.categoria,
    subcategoria = excluded.subcategoria;

-- 3. FUNCIÓN AUXILIAR TEMPORAL PARA POBLAR KITS COMPUESTOS
do $$
declare
    v_trafo_100 uuid;
    v_trafo_75  uuid;
    v_trafo_50  uuid;
    v_trafo_25  uuid;

    v_cinchos   uuid;
    v_cable     uuid;
    v_herrajes  uuid;
    v_codo      uuid;
    v_cortacir  uuid;
    v_aparta    uuid;

    v_kit_id    uuid;
begin
    select id into v_trafo_100 from catalogo_materiales where nombre_base = 'TRANSFORMADOR 100 KVA' and variante = '13.2 kV / 220-127 V';
    select id into v_trafo_75  from catalogo_materiales where nombre_base = 'TRANSFORMADOR 75 KVA' and variante = '13.2 kV / 220-127 V';
    select id into v_trafo_50  from catalogo_materiales where nombre_base = 'TRANSFORMADOR 50 KVA' and variante = '13.2 kV / 220-127 V';
    select id into v_trafo_25  from catalogo_materiales where nombre_base = 'TRANSFORMADOR 25 KVA' and variante = '13.2 kV / 220-127 V';

    select id into v_cinchos  from catalogo_materiales where nombre_base = 'CINCHOS DE FIJACIÓN INOXIDABLE';
    select id into v_cable    from catalogo_materiales where nombre_base = 'CABLE DE COBRE DESNUDO 2/0 AWG';
    select id into v_herrajes from catalogo_materiales where nombre_base = 'HERRAJES Y SOPORTE PARA TRANSFORMADOR';
    select id into v_codo     from catalogo_materiales where nombre_base = 'CONECTOR TIPO CODO OCC 200 A';
    select id into v_cortacir from catalogo_materiales where nombre_base = 'CORTACIRCUITOS FUSIBLE 15 KV';
    select id into v_aparta   from catalogo_materiales where nombre_base = 'APARTARRAYOS DE POLÍMERO 12 KV';

    -- KIT 100 kVA - De Remate
    insert into material_kits (nombre, material_principal_id, configuracion, descripcion, activo)
    values ('Kit Transformador 100 kVA', v_trafo_100, 'De remate', 'Ensamble de remate terminal para transformador 100 kVA con herrajes, cableado y protecciones', true)
    returning id into v_kit_id;

    insert into material_kit_items (kit_id, material_id, cantidad) values
        (v_kit_id, v_herrajes, 1),
        (v_kit_id, v_cable, 15),
        (v_kit_id, v_cinchos, 4),
        (v_kit_id, v_codo, 3),
        (v_kit_id, v_cortacir, 3),
        (v_kit_id, v_aparta, 3)
    on conflict (kit_id, material_id) do update set cantidad = excluded.cantidad;

    -- KIT 100 kVA - De Paso
    insert into material_kits (nombre, material_principal_id, configuracion, descripcion, activo)
    values ('Kit Transformador 100 kVA', v_trafo_100, 'De paso', 'Ensamble de paso para transformador 100 kVA en línea continua', true)
    returning id into v_kit_id;

    insert into material_kit_items (kit_id, material_id, cantidad) values
        (v_kit_id, v_herrajes, 1),
        (v_kit_id, v_cable, 25),
        (v_kit_id, v_cinchos, 6),
        (v_kit_id, v_codo, 6),
        (v_kit_id, v_cortacir, 3),
        (v_kit_id, v_aparta, 3)
    on conflict (kit_id, material_id) do update set cantidad = excluded.cantidad;

    -- KIT 75 kVA - De Remate
    insert into material_kits (nombre, material_principal_id, configuracion, descripcion, activo)
    values ('Kit Transformador 75 kVA', v_trafo_75, 'De remate', 'Ensamble de remate terminal para transformador 75 kVA', true)
    returning id into v_kit_id;

    insert into material_kit_items (kit_id, material_id, cantidad) values
        (v_kit_id, v_herrajes, 1),
        (v_kit_id, v_cable, 15),
        (v_kit_id, v_cinchos, 4),
        (v_kit_id, v_codo, 3),
        (v_kit_id, v_cortacir, 3),
        (v_kit_id, v_aparta, 3)
    on conflict (kit_id, material_id) do update set cantidad = excluded.cantidad;

    -- KIT 75 kVA - De Paso
    insert into material_kits (nombre, material_principal_id, configuracion, descripcion, activo)
    values ('Kit Transformador 75 kVA', v_trafo_75, 'De paso', 'Ensamble de paso para transformador 75 kVA', true)
    returning id into v_kit_id;

    insert into material_kit_items (kit_id, material_id, cantidad) values
        (v_kit_id, v_herrajes, 1),
        (v_kit_id, v_cable, 25),
        (v_kit_id, v_cinchos, 6),
        (v_kit_id, v_codo, 6),
        (v_kit_id, v_cortacir, 3),
        (v_kit_id, v_aparta, 3)
    on conflict (kit_id, material_id) do update set cantidad = excluded.cantidad;

    -- KIT 50 kVA - De Remate
    insert into material_kits (nombre, material_principal_id, configuracion, descripcion, activo)
    values ('Kit Transformador 50 kVA', v_trafo_50, 'De remate', 'Ensamble de remate terminal para transformador 50 kVA', true)
    returning id into v_kit_id;

    insert into material_kit_items (kit_id, material_id, cantidad) values
        (v_kit_id, v_herrajes, 1),
        (v_kit_id, v_cable, 12),
        (v_kit_id, v_cinchos, 4),
        (v_kit_id, v_codo, 3),
        (v_kit_id, v_cortacir, 3),
        (v_kit_id, v_aparta, 3)
    on conflict (kit_id, material_id) do update set cantidad = excluded.cantidad;

    -- KIT 50 kVA - De Paso
    insert into material_kits (nombre, material_principal_id, configuracion, descripcion, activo)
    values ('Kit Transformador 50 kVA', v_trafo_50, 'De paso', 'Ensamble de paso para transformador 50 kVA', true)
    returning id into v_kit_id;

    insert into material_kit_items (kit_id, material_id, cantidad) values
        (v_kit_id, v_herrajes, 1),
        (v_kit_id, v_cable, 20),
        (v_kit_id, v_cinchos, 6),
        (v_kit_id, v_codo, 6),
        (v_kit_id, v_cortacir, 3),
        (v_kit_id, v_aparta, 3)
    on conflict (kit_id, material_id) do update set cantidad = excluded.cantidad;

    -- KIT 25 kVA - De Remate
    insert into material_kits (nombre, material_principal_id, configuracion, descripcion, activo)
    values ('Kit Transformador 25 kVA', v_trafo_25, 'De remate', 'Ensamble de remate terminal para transformador 25 kVA', true)
    returning id into v_kit_id;

    insert into material_kit_items (kit_id, material_id, cantidad) values
        (v_kit_id, v_herrajes, 1),
        (v_kit_id, v_cable, 10),
        (v_kit_id, v_cinchos, 4),
        (v_kit_id, v_codo, 3),
        (v_kit_id, v_cortacir, 3),
        (v_kit_id, v_aparta, 3)
    on conflict (kit_id, material_id) do update set cantidad = excluded.cantidad;

    -- KIT 25 kVA - De Paso
    insert into material_kits (nombre, material_principal_id, configuracion, descripcion, activo)
    values ('Kit Transformador 25 kVA', v_trafo_25, 'De paso', 'Ensamble de paso para transformador 25 kVA', true)
    returning id into v_kit_id;

    insert into material_kit_items (kit_id, material_id, cantidad) values
        (v_kit_id, v_herrajes, 1),
        (v_kit_id, v_cable, 18),
        (v_kit_id, v_cinchos, 6),
        (v_kit_id, v_codo, 6),
        (v_kit_id, v_cortacir, 3),
        (v_kit_id, v_aparta, 3)
    on conflict (kit_id, material_id) do update set cantidad = excluded.cantidad;
end;
$$;
