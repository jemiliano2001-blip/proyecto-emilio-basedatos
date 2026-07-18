# Prompt: revisión y mejora del diseño de base de datos — Proyecto Emilio

Cópialo tal cual en un chat nuevo de Claude.

---

Eres un arquitecto de base de datos senior especializado en PostgreSQL, con experiencia en sistemas de trazabilidad financiera/operativa para empresas medianas (inventario, compras, presupuestos por proyecto). Quiero que audites y propongas mejoras al diseño de base de datos de mi app — trátalo con el mismo cuidado que un sistema bancario chico: los errores aquí cuestan dinero real.

## Contexto del negocio

Empresa de construcción/instalación eléctrica. La app rastrea materiales y presupuestos por obra: qué se cotizó, qué se compró, qué se recibió, qué se asignó a cada obra y qué queda disponible. Roles del sistema (columna `usuarios.rol`, enum):

- `personal` — cuadrillas en campo, levantan solicitudes de material
- `compras` — cotiza, aprueba órdenes de compra, revisa recepción
- `proyectos` — define especificaciones técnicas de materiales
- `operacion` — usa el sistema día a día, más que nadie
- `acceso_total` — ve todo, no opera el día a día

Stack: Next.js 14 + Supabase (Postgres). RLS obligatorio en toda tabla desde su creación, contra una tabla real de roles (`usuarios.rol`), nunca contra JWT claims del cliente. `service_role` nunca en frontend.

## Esquema actual (resumen — puedo pegarte el SQL completo si lo necesitas)

- `usuarios(id, nombre, rol, activo)` — 1:1 con `auth.users`
- `obras(id, nombre, fraccionamiento, paquete, ubicacion, estado, cerrado_en)` — **pendiente de confirmar**: ¿"obra" para efectos de presupuesto es el fraccionamiento o el paquete? Hoy fraccionamiento y paquete son columnas de texto libre en la misma fila, sin jerarquía real en tablas separadas.
- `catalogo_materiales(id, nombre_base, variante, unidad_medida, categoria, subcategoria, especificacion, foto_url, activo)` + `catalogo_materiales_alias(material_id, alias)` — un material puede tener nombre técnico + varios alias comerciales (problema real: el mismo material tiene distintos nombres según el proveedor)
- `obra_material_contratado(obra_id, material_id, cantidad_contratada)` — el tope NO es por obra en general, es por combinación obra+material. Vista `v_saldo_material_obra` calcula disponible = contratado − usado (usado hoy es 0 a propósito, se activa cuando exista `asignaciones_material`)
- `solicitudes_material(id, obra_id, solicitante_id, estado, nota)` + `solicitud_items(solicitud_id, material_id, cantidad_solicitada, nota)` — estado hoy solo `pendiente`/`cancelada`, a propósito minimal
- `notificaciones(usuario_id, rol_destino, titulo, mensaje, tipo, referencia_id, leida)`
- `auditoria(tabla, registro_id, usuario_id, accion, datos_antes, datos_despues)` — trigger genérico ya aplicado en tablas sensibles

## Roadmap de fases (ya construidas: 1 y 2; NO adelantes su diseño, solo prepáralo)

1. ✅ Catálogo + Obras + Topes
2. ✅ Solicitudes de campo (Personal)
3. Cotización y Órdenes de Compra (Talía) — nuevos estados de solicitud, tabla de órdenes de compra, relación con proveedores
4. Recepción / checklist de materiales — qué llegó vs. qué se pidió, quién lo recibió
5. Asignación de materiales a obra — activa el saldo real (`cantidad_usada` deja de ser 0)
6. **Traspasos entre obras** — el más delicado: una operación afecta 2 presupuestos de obra distintos a la vez, tiene que ser atómica
7. Cierre de obra y reporte de conciliación

## Lo que quiero que revises

1. **Normalización y jerarquía de obras**: ¿la estructura fraccionamiento/paquete como columnas planas va a sostenerse cuando haya reportes por fraccionamiento completo? ¿Conviene una tabla `fraccionamientos` separada con `obras.fraccionamiento_id`? Dame el trade-off, no asumas que sí.
2. **Diseño para Fase 6 (traspasos)** antes de que la construya: ¿qué forma de tabla necesito para que un traspaso entre 2 obras sea atómico y auditable, sin duplicar lógica de `asignaciones_material`? Adelántame el diseño (sin implementarlo).
3. **RLS**: revisa las políticas que te puedo pegar — ¿hay algún hueco de seguridad, algún default-deny que se me haya pasado (como me pasó con `notificaciones`, que no tenía policy de insert y nadie se dio cuenta hasta que algo intentó escribir ahí)?
4. **Índices y performance**: con crecimiento real (cientos de obras, miles de solicitudes/año), ¿qué índices faltan? ¿la vista `v_saldo_material_obra` va a escalar o conviene materializarla?
5. **Integridad financiera**: ¿el modelo actual permite que una asignación exceda el tope contratado sin que la base de datos lo impida (constraint o trigger), o depende 100% de que el frontend valide?
6. **Nombres técnicos vs. alias comerciales**: ¿el diseño actual de `catalogo_materiales_alias` es suficiente para que Personal encuentre un material por cualquier nombre que use, o falta algo (búsqueda difusa, sinónimos por proveedor)?

## Formato de respuesta que quiero

1. Diagnóstico honesto — qué está bien, qué es frágil
2. Top 5 cambios priorizados, cada uno con el trade-off (qué gano, qué complico)
3. Boceto en SQL de los cambios que recomiendes (no como migración final, como propuesta a discutir)
4. Si te falta contexto (volumen de datos esperado, frecuencia de traspasos, etc.), pregúntame antes de asumir

No cambies el stack (Postgres/Supabase, nunca NoSQL) ni las convenciones de nombres (tablas y columnas en español, snake_case).
