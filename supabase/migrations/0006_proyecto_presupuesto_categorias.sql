-- =====================================================================
-- MIGRACIÓN 0006 — Proyecto: cliente, presupuesto MXN, categorías fijas
-- Revisar antes de aplicar en remoto (datos financieros).
-- =====================================================================

-- Cliente y presupuesto monetario por proyecto (tabla obras se mantiene)
alter table obras
    add column if not exists cliente text,
    add column if not exists presupuesto_mxn numeric(14,2) not null default 0
        check (presupuesto_mxn >= 0);

comment on column obras.cliente is 'Cliente del proyecto';
comment on column obras.presupuesto_mxn is 'Presupuesto monetario del proyecto en MXN';
comment on column obras.paquete is 'Identificador interno del paquete/lote — confirmar definición con Emilio';

-- Normalizar categorías/subcategorías libres previas (quedan NULL si no mapean)
update catalogo_materiales
set categoria = null, subcategoria = null
where categoria is not null
  and categoria not in ('Obra Civil', 'Electromecánico');

update catalogo_materiales
set subcategoria = null
where subcategoria is not null
  and not (
      (categoria = 'Obra Civil' and subcategoria in ('Registros', 'Tubería'))
      or (
          categoria = 'Electromecánico'
          and subcategoria in (
              'Transformadores',
              'Cableado',
              'Accesorios subterráneos',
              'Accesorios aéreos (herrajes)',
              'Alumbrado público'
          )
      )
  );

alter table catalogo_materiales
    drop constraint if exists catalogo_materiales_categoria_check;

alter table catalogo_materiales
    add constraint catalogo_materiales_categoria_check
    check (
        categoria is null
        or categoria in ('Obra Civil', 'Electromecánico')
    );

alter table catalogo_materiales
    drop constraint if exists catalogo_materiales_subcategoria_par_check;

alter table catalogo_materiales
    add constraint catalogo_materiales_subcategoria_par_check
    check (
        subcategoria is null
        or (
            categoria = 'Obra Civil'
            and subcategoria in ('Registros', 'Tubería')
        )
        or (
            categoria = 'Electromecánico'
            and subcategoria in (
                'Transformadores',
                'Cableado',
                'Accesorios subterráneos',
                'Accesorios aéreos (herrajes)',
                'Alumbrado público'
            )
        )
    );

-- Movimientos de presupuesto monetario (reserva / gasto / liberación)
create type tipo_movimiento_presupuesto as enum (
    'reserva',
    'gasto',
    'liberacion'
);

create table obra_presupuesto_movimientos (
    id              uuid primary key default gen_random_uuid(),
    obra_id         uuid not null references obras(id) on delete cascade,
    solicitud_id    uuid references solicitudes_material(id) on delete set null,
    tipo            tipo_movimiento_presupuesto not null,
    monto_mxn       numeric(14,2) not null check (monto_mxn > 0),
    nota            text,
    creado_por      uuid references usuarios(id),
    creado_en       timestamptz not null default now()
);

create index idx_obra_presupuesto_movimientos_obra
    on obra_presupuesto_movimientos(obra_id);
create index idx_obra_presupuesto_movimientos_solicitud
    on obra_presupuesto_movimientos(solicitud_id);

alter table obra_presupuesto_movimientos enable row level security;

create policy obra_presupuesto_movimientos_select on obra_presupuesto_movimientos
    for select using (
        auth_rol() in ('compras', 'proyectos', 'operacion', 'acceso_total', 'personal')
    );

-- Escritura solo vía RPC security definer; sin INSERT directo de clientes.
create policy obra_presupuesto_movimientos_insert on obra_presupuesto_movimientos
    for insert with check (auth_rol() = 'acceso_total');

create trigger trg_auditoria_obra_presupuesto_movimientos
    after insert or update or delete on obra_presupuesto_movimientos
    for each row execute function fn_auditoria();

-- Vista de saldo monetario
create or replace view v_saldo_presupuesto_obra
with (security_invoker = true)
as
select
    o.id as obra_id,
    o.presupuesto_mxn,
    coalesce(sum(case when m.tipo = 'reserva' then m.monto_mxn else 0 end), 0)
        - coalesce(sum(case when m.tipo = 'liberacion' then m.monto_mxn else 0 end), 0)
        as comprometido_mxn,
    coalesce(sum(case when m.tipo = 'gasto' then m.monto_mxn else 0 end), 0)
        as gastado_mxn,
    o.presupuesto_mxn
        - (
            coalesce(sum(case when m.tipo = 'reserva' then m.monto_mxn else 0 end), 0)
            - coalesce(sum(case when m.tipo = 'liberacion' then m.monto_mxn else 0 end), 0)
          )
        - coalesce(sum(case when m.tipo = 'gasto' then m.monto_mxn else 0 end), 0)
        as disponible_mxn
from obras o
left join obra_presupuesto_movimientos m on m.obra_id = o.id
group by o.id, o.presupuesto_mxn;

grant select on v_saldo_presupuesto_obra to authenticated;
