# Revisión de consistencia de flujos y visibilidad por usuario

Fecha: 2026-10-01. Alcance: código actual, navegación, páginas, acciones, sincronización y autorización SQL; contraste de solo lectura con el proyecto Supabase `proyecto-emilio-basedatos`.

No se modificaron código funcional, usuarios, datos, permisos ni migraciones. No se ejecutaron los scripts E2E remotos, commit, push o deploy. Los cambios previos en AGENTS.md, CLAUDE.md y GEMINI.md se conservaron.

## Resultado

La aplicación distingue roles en el menú y en muchas acciones, pero eso todavía no garantiza que cada usuario reciba únicamente la información de su responsabilidad. Las prioridades son proteger los campos financieros, definir el alcance por proyecto y recuperar los controles de propietario de recepción. Hay además diferencias entre las acciones que anuncia la interfaz y las que ejecuta el servidor.

## Evidencia y límites

- `npm.cmd test`: 50 pruebas aprobadas, 0 fallidas.
- `npm.cmd run typecheck`: exit 0.
- `npm.cmd run lint`: exit 0.
- Consultas remotas de solo lectura: políticas RLS, privilegios de columnas y funciones, definiciones de RPC, tablas, buckets e historial de migraciones. No se devolvieron datos personales ni importes de operaciones.
- Prueba exploratoria con PGlite y datos sintéticos: Personal puede seleccionar dos proyectos, sus presupuestos y `catalogo_materiales.precio_base`.
- Prueba exploratoria con PGlite: `0005` rechaza el detalle de una recepción ajena; después de cargar la parte de base de datos de `0018`, la tabla sigue ocultando la recepción mediante RLS pero `detalle_recepcion` entrega su detalle. También lo entrega con el usuario inactivo y `auth_rol() = NULL`.
- La definición remota de `detalle_recepcion` conserva el guard y la ausencia de filtro de propietario de `0018`; anon NO tiene EXECUTE. El riesgo identificado afecta a cuentas autenticadas, incluida una cuenta inactiva que aún conserve un token válido.
- No se hicieron pruebas con sesiones reales de los seis roles ni recorrido visual de navegador. No se ejecutó build. Los tests locales no demuestran el resultado de PostgREST, cookies, Storage o UI en producción.
- Durante la revisión, el remoto tenía 0 recepciones y 0 filas de documentos. Los huecos de esos módulos están comprobados en definición/configuración y con datos sintéticos; no se afirma una exposición observada de documentos o recepciones reales.

## Prioridad alta

### 1. Personal puede consultar campos financieros por la API

**Evidencia:** `supabase/migrations/0001_schema_inicial.sql:133`, `0007_requisiciones_flujo.sql:8`, `0012_precio_base_kits_documentos.sql:7`; privilegios y políticas remotas.

`authenticated` tiene SELECT sobre `catalogo_materiales.precio_base`, `obras.presupuesto_mxn`, `solicitud_items.monto_mxn` y `obra_presupuesto_movimientos.monto_mxn`. Las políticas permiten a Personal leer catálogo/proyectos, partidas de sus requisiciones y movimientos financieros. Ocultar esos valores con `puedeVerPrecios` no impide la lectura directa.

`app/materiales/page.tsx` ya evita enviar precio a su componente cliente cuando el rol no puede verlo. La restricción SQL sigue pendiente. El detalle de solicitud y kits aún consultan precios aunque después condicionen su renderizado; no se afirma que toda variable de un Server Component viaje al navegador.

**Mejora:** separar las lecturas operativas de las financieras mediante una vista/RPC que valide `auth_rol()`, retirar acceso directo a columnas sensibles y adaptar sus consumidores. RLS controla filas: los seis roles de negocio comparten el rol PostgreSQL `authenticated`, por lo que una concesión de columna a ese rol no distingue Personal de Compras. Añadir regresiones de catálogo, proyecto, partidas y movimientos; el test actual de precios se centra en traspasos/RPC financieras.

### 2. No existe un alcance de usuario por proyecto

**Evidencia:** `components/MatrizPermisosRoles.tsx:28,38`, `app/solicitudes/nueva/page.tsx:25`, `app/inventario/page.tsx:30`, `app/inventario/[obraId]/page.tsx:37`, políticas remotas de `obras` y RPC `listar_ordenes_checklist` / `reportar_instalacion_material`.

La guía promete que Personal solo ve la obra asignada, pero las tablas actuales no incluyen una relación de asignaciones usuario–proyecto. Nueva requisición carga todos los proyectos activos; inventario no aplica asignación; la RPC de órdenes por recibir devuelve órdenes de todos los proyectos a usuarios con rol válido. Reportar instalación verifica rol y saldo, sin comprobar una asignación al proyecto.

**Mejora:** definir una asignación explícita (uno o varios proyectos por usuario, según la operación) y exigirla en SELECT, creación de solicitudes, recepción, instalaciones y traspasos. El mismo control debe cubrir accesos por URL, RPC y sincronización offline. La lista de solicitudes sí restringe a Personal por solicitante: ese control es útil, pero no equivale a restringir proyectos.

### 3. El detalle de recepción perdió el control de propietario

**Evidencia:** `0005_recepcion_materiales.sql:653` frente a `0018_fotos_obras_recepciones.sql:26,36,70` y `0019_evidencias_fotograficas_metadatos.sql:88,99,133`; definición remota.

La primera función comprobaba `receptor_id` para Personal. La redefinición de `0018`, para agregar fotos, quitó esa comprobación. Al ejecutarse como SECURITY DEFINER, una cuenta de Personal que conoce el UUID puede obtener una recepción ajena aunque RLS y `listar_recepciones` la oculten. El guard `if not (auth_rol() in (...))` tampoco rechaza NULL: un usuario inactivo con token aún válido atraviesa esa condición.

**Mejora:** rechazar explícitamente ausencia de identidad/rol activo; recuperar el control de propietario o aplicar la asignación al proyecto acordada. Añadir prueba de detalle ajeno y usuario inactivo después de todas las redefiniciones. La migración `0019` repite el patrón y debe corregirse junto con la versión viva.

### 4. Los documentos mezclan contenido operativo y financiero y usan URLs públicas

**Evidencia:** `0012_precio_base_kits_documentos.sql:87`, `lib/actions/documentos.ts:70`, `lib/validations/documento.ts:3`, `app/obras/[id]/page.tsx:79` y bucket remoto `obra-documentos` con `public = true`.

La lectura de documentos solo exige autenticación y no filtra `tipo_documento`; incluye presupuesto formal y conciliación de precios. El detalle del proyecto los entrega también a Personal. La subida genera una URL pública: quien tenga esa URL puede acceder al archivo sin la autorización de la aplicación.

**Mejora:** bucket privado, acceso autenticado o URL firmada después de comprobar rol/proyecto/tipo; Personal recibe planos y documentación operativa permitida, sin presupuestos ni conciliaciones financieras. Revisar también las fotografías de remisiones, que pueden contener importes aunque la pantalla no los dibuje.

## Consistencia del movimiento del sistema

| Prioridad | Inconsistencia comprobada | Consecuencia y mejora |
|---|---|---|
| Media | `app/solicitudes/page.tsx:57,176`: “Ver todas” apunta a `/solicitudes`, que redirige a la cola por defecto para Compras/Finanzas. Además, se les oculta el filtro de estatus. | No abre el historial completo por ese control. Usar un modo explícito de historial y conservar búsqueda/proyecto/paginación al moverse entre cola y detalle. |
| Media | `components/SolicitudesListClient.tsx:110,340` muestra “Pagar en lote” a Acceso Total porque también cumple el permiso de Finanzas; `lib/actions/solicitudes.ts:732` solo entra a pagos si el rol exacto es `finanzas`. | Emilio confirma pagos, pero el servidor intenta aprobación de Compras. La etapa debe viajar explícita y ser validada con el permiso correspondiente; no inferirla del rol cuando uno tiene varios permisos. |
| Media | `components/MatrizPermisosRoles.tsx:55` afirma que Proyectos crea obras, pero `lib/roles.ts:3`, las actions y la RPC solo permiten Operación/Acceso Total. | La guía promete una acción inexistente para Manuel. Resolver quién crea proyectos y reflejar la decisión en guía, menú, servidor y SQL. No ampliar el permiso por intuición. |
| Media | TopBar y `GlobalClientTools` montan Abastecimiento para todos; el drawer no recibe rol y siempre inicia en Compras. El menú oculta traspasos a Personal, pero CommandPalette permite navegar a ellos (`components/CommandPalette.tsx:222`). | La interfaz de campo presenta colas ajenas a su tarea y distintos accesos según el punto de entrada. Filtrar herramientas, pestañas y entrada inicial por responsabilidades; reutilizar la misma política en menú, buscador y URLs. No se afirma que el drawer exponga OCs financieras a Personal: RLS de OCs las restringe. |
| Media | `app/page.tsx:122,150` muestra “+12% vs trimestre anterior” y “100% cotejo validado en campo”, con series de gráfica fijas. | Usuarios de supervisión reciben indicadores que no fueron calculados. Retirar esas afirmaciones o derivarlas de datos reales; mostrar “sin datos” cuando corresponda. |
| Media | `app/obras/[id]/page.tsx:67,123` ignora el error de saldo financiero y sustituye por gasto/compromiso cero y disponible igual al presupuesto base. | Una falla de consulta puede parecer saldo completo. Mostrar saldo no disponible y permitir reintentar, sin inventar disponibilidad. |
| Media | `lib/actions/recepciones.ts:169,233,238` no inspecciona `error` en las escrituras posteriores de fotos; `recepcion_fotos` no existe en el remoto. | La recepción puede terminar correctamente y la evidencia/metadatos no quedar registrados. Mostrar éxito parcial, comprobar cada resultado y permitir recuperación. No basta con `try/catch` para respuestas de Supabase con `{ error }`. |
| Media | `components/ReportarInstalacionForm.tsx:39` bloquea instalaciones sin conexión; solicitud y checklist sin fotos sí tienen cola. | Personal usa comportamientos distintos en el mismo flujo de campo. Agregar cola de instalaciones con propietario e idempotencia, o definir claramente el alcance conectado de esta acción. Las fotos actuales requieren conexión y el formulario lo advierte. |

## Lo que debería ver y hacer cada rol

Propuesta de organización basada en responsabilidades vigentes; la asignación de proyectos y la creación por Proyectos requieren una decisión explícita. No son permisos nuevos aplicados.

| Rol | Vista principal propuesta | Acciones y límites |
|---|---|---|
| Personal | Sus proyectos asignados, solicitudes propias, pedidos por recibir del proyecto, cantidades de inventario y avisos de campo. | Solicitar, capturar recepción y reportar instalación. Sin precios, MXN, facturas ni documentos financieros. Acceso de traspasos de campo debe decidirse y ser uniforme. |
| Compras — Talía | Cola Recibida, revisión de partidas/proveedores/precios, recepción pendiente de revisión e historial. | Cotizar, ajustar/aprobar Compras y revisar recepción. Consulta de saldos necesaria para abastecer; sin autorizar pago final. |
| Finanzas — Blanquita | Cola En proceso, importes comprometidos, OCs, facturas y recepciones en lectura. | Autorizar pago/emisión de OC y gestionar facturas. Sin captura de recepción ni cambios de especificaciones técnicas. |
| Proyectos — Manuel | Catálogo, kits, topes, saldos de cantidades y avance de proyectos. | Planificación y asignación de materiales; traspasos según permisos actuales. Aclarar si crea proyectos: hoy no puede. |
| Operación — Iveth | Proyectos, recepción, inventario, traspasos y bitácora. | Gestión/cierre de proyectos, coordinación y seguimiento. Sin pagos bancarios ni administración de cuentas. |
| Acceso Total — Emilio | Resumen de excepciones/pendientes de todas las etapas y acceso a todos los módulos. | Todas las acciones, escogiendo explícitamente Compras o Finanzas en lotes. Único administrador de usuarios. |

## Flujo que conviene hacer explícito

1. Personal captura requisición; puede cancelarla mientras siga Recibida y le pertenezca.
2. Compras revisa cada partida (también flete/camiones/servicios), proveedor, cantidad, precio y presupuesto dual; aprueba o devuelve/rechaza con motivo.
3. Finanzas ve la requisición En proceso, autoriza el pago y emite las OCs agrupadas por proyecto/proveedor.
4. Personal recibe físicamente los materiales del proyecto; Compras revisa el checklist.
5. Inventario refleja las cantidades aprobadas y los traspasos; Personal reporta instalación.
6. Operación controla cierre/conciliación; Acceso Total puede reabrir.

La requisición `finalizada` significa pago/OC emitida en el flujo actual: no garantiza entrega física. Conviene mostrar la etapa pendiente de entrega/revisión/instalación junto al estatus, para no confundir cierre administrativo con material recibido.

La revisión de servicios todavía está incompleta: `app/solicitudes/[id]/page.tsx:178` arma el editor solo con materiales; una línea de flete no tiene la misma edición/asignación de proveedor. La RPC de pago permite agrupación con proveedor NULL. Resolver su revisión/recepción como servicio antes de automatizar su avance.

## Controles que ya están bien y límites de cobertura

- Roles consultados desde `usuarios`, con `activo = true` en `auth_rol`; los permisos no se toman de metadata editable del cliente.
- Administración de cuentas solo para Acceso Total; bitácora para Acceso Total y Operación, tanto en UI como en políticas actuales.
- Finanzas tiene habilitado `listar_recepciones` en el remoto por `0032`; no se vuelve a reportar el hallazgo antiguo de acceso denegado como abierto. El KPI de Inicio usa la tabla directamente, cuya policy no incluye Finanzas: su contador puede diferir de la lista por RPC.
- Precios de traspasos tienen restricción de columnas/RPC; no extrapolar esa cobertura al catálogo o presupuesto de obras.
- Cierre/topes y estados de OC cuentan con endurecimiento aplicado (`0029`, `0030`); inventario con traspasos y recepción para Finanzas (`0031`, `0032`) constan en el historial remoto. La migración `0016` también está aplicada, contrario al pendiente antiguo del hub.
- Cola offline aislada por usuario y sin cachear HTML privado en el service worker.
- `tests/db-fixture.mjs:11,35` carga una selección de migraciones, omitiendo `0018`/`0019`: los tests existentes de autorización no alcanzaban la redefinición de recepción que introdujo la regresión. Ampliar cobertura después de la cadena efectiva, con casos positivos y negativos por rol/propietario/campos.

## Orden recomendado

1. Proteger detalle de recepción y documentos/columnas financieros; acordar alcance por proyecto.
2. Aplicar ese alcance a servidor, RLS/RPC, rutas y sincronización; probar accesos directos además de botones.
3. Corregir historial, etapa de acciones en lote y guía de roles.
4. Ajustar Inicio y herramientas al trabajo de cada usuario; retirar métricas inventadas y fallbacks financieros engañosos.
5. Completar evidencia y continuidad offline, con pruebas de sesiones reales antes de publicar.

Graphify: consulta dirigida realizada sobre roles/permisos/navegación; resultado contrastado con fuentes y SQL remoto. Sin actualización AST porque no se cambió código indexable. El grafo no se usó para declarar cobertura RLS.

## Seguimiento: implementación autorizada

Emilio confirmó asignaciones múltiples para Personal, creación/edición solo por Operación y Acceso Total, y traspasos de proyectos asignados. Los cambios de acceso, navegación, aprobaciones, evidencia e instalaciones quedaron preparados localmente en las migraciones 0034–0038 y sus consumidores. El diagnóstico anterior conserva la evidencia del estado auditado, no describe el código local final.

Véase [implementación, validación y publicación](2026-10-01-implementacion-permisos.md). Tras autorización posterior, SQL y frontend publicados el 2026-10-01. Suite final 62/62, types/lint/build aprobados y revisiones focales aprobadas. PostgREST y HTTP reales verificados; quedan privacidad de fotografías/remisiones públicas, descargas Storage y recorridos autenticados completos. La actualización AST corresponde al cierre de implementación/publicación, no a la fase inicial de auditoría.
