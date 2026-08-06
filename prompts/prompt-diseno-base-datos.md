# Prompt: revisión y mejora del diseño de base de datos — Proyecto Emilio

Cópialo tal cual en un chat nuevo de Claude.

---

Eres un arquitecto de base de datos senior especializado en PostgreSQL, con experiencia en sistemas de trazabilidad financiera/operativa para empresas medianas (inventario, compras, presupuestos por proyecto). Quiero que audites y propongas mejoras al diseño de base de datos de mi app — trátalo con el mismo cuidado que un sistema bancario chico: los errores aquí cuestan dinero real.

## Contexto del negocio

Empresa de construcción/instalación eléctrica. La app rastrea materiales y presupuestos por **proyecto** (tabla `obras`): qué se pidió, qué se compró, qué se recibió, qué queda disponible (cantidad y dinero). Roles del sistema (columna `usuarios.rol`, enum):

- `personal` — cuadrillas en campo, levantan requisiciones
- `compras` — aprueba requisiciones (Thalía); también cotiza/revisa recepción (flujo legacy)
- `finanzas` — paga/aprueba requisiciones en proceso (Blanquita) y dispara emisión de OC
- `proyectos` — define especificaciones técnicas de materiales
- `operacion` — usa el sistema día a día, más que nadie
- `acceso_total` — ve todo, no opera el día a día

Stack: Next.js 14 + Supabase (Postgres). RLS obligatorio en toda tabla desde su creación, contra una tabla real de roles (`usuarios.rol`), nunca contra JWT claims del cliente. `service_role` nunca en frontend.

## Esquema actual (resumen — puedo pegarte el SQL completo si lo necesitas)

- `usuarios(id, nombre, rol, activo)` — 1:1 con `auth.users` (incluye rol `finanzas`)
- `obras(id, nombre, cliente, fraccionamiento, paquete, ubicacion, estado, presupuesto_mxn, cerrado_en)` — UI dice “proyecto”; `paquete` sigue siendo texto libre **pendiente de confirmar definición de negocio con Emilio**
- `catalogo_materiales(..., categoria, subcategoria, ...)` — categorías fijas: Obra Civil / Electromecánico + subcategorías validadas por CHECK
- `obra_material_contratado(obra_id, material_id, cantidad_contratada)` + `v_saldo_material_obra` (contratado − comprometido − usado)
- `obra_presupuesto_movimientos(obra_id, solicitud_id, tipo reserva|gasto|liberacion, monto_mxn)` + `v_saldo_presupuesto_obra`
- `solicitudes_material` estados: `recibida` → `en_proceso` → `finalizada` (+ `rechazada`/`cancelada`); legacy remap desde pendiente/en_cotizacion/aprobada
- `solicitud_items(tipo_linea material|flete|camiones|mantenimiento|otro, material_id nullable, descripcion, monto_mxn, ...)`
- `solicitud_reservas_cantidad` — reserva al aprobar Compras; aplicada al pagar Finanzas
- RPCs: `aprobar_solicitud_compras`, `aprobar_pago_solicitud`, `rechazar_solicitud`, `cancelar_solicitud`
- `ordenes_compra` puede nacer desde `solicitud_id` (sin cotización); cotizaciones quedan legacy
- `notificaciones`, `auditoria` — triggers en tablas sensibles / presupuesto

## Roadmap de fases

1. ✅ Catálogo + Proyectos + Topes (+ cliente / presupuesto MXN / categorías)
2. ✅ Requisiciones de campo (tipos de línea, buscador)
3. ✅ Cotización/OC (legacy) + puente req→OC vía Finanzas
4. ✅ Recepción / checklist offline
5. Asignación de materiales a obra (alinear con reservas/usados)
6. **Traspasos entre obras** — atómico y auditable
7. Cierre de obra y reporte de conciliación

## Lo que quiero que revises

1. **Normalización y jerarquía de obras/proyectos**: ¿fraccionamiento/paquete como columnas planas aguanta reportes, o conviene `fraccionamientos`? Trade-off, no asumas que sí.
2. **Presupuesto dual (cantidad + MXN)**: ¿el modelo reserva→gasto/liberación evita sobregiro y doble conteo? ¿falta constraint/trigger adicional?
3. **Diseño para Fase 6 (traspasos)** sin implementarlo: forma de tabla atómica y auditable.
4. **RLS y RPCs**: ¿huecos en policies o en `security definer` (bypass accidental)?
5. **Índices/performance**: `v_saldo_material_obra` y `v_saldo_presupuesto_obra` con cientos de obras.
6. **Alias comerciales** en catálogo: ¿suficiente para búsqueda en campo?

## Formato de respuesta que quiero

1. Diagnóstico honesto — qué está bien, qué es frágil
2. Top 5 cambios priorizados, cada uno con el trade-off
3. Boceto en SQL de los cambios que recomiendes (propuesta a discutir)
4. Si te falta contexto, pregúntame antes de asumir

No cambies el stack (Postgres/Supabase, nunca NoSQL) ni las convenciones de nombres (tablas y columnas en español, snake_case).
