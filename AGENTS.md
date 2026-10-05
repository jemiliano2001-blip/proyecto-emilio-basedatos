## Learned User Preferences
<!-- GRAPHIFY-WORKFLOW:START -->
## Graphify: flujo automático proporcional
- No exige palabras clave. Al iniciar una tarea de código, ubica la raíz real, revisa el estado Git y comprueba `graphify-out/graph.json`; reutiliza ese contexto durante la tarea.
- Archivo/ruta conocida o ajuste aislado de texto/estilo: inspección nativa directa. Módulo desconocido, bug entre archivos o arquitectura: primero `graphify query "<concepto>" --budget 1200`; lee después las fuentes pertinentes. Máximo dos consultas dirigidas antes de buscar nativamente si el resultado no ayuda. No cargues reportes/wiki completos por rutina.
- Antes de cambiar contratos, exports/imports, rutas, utilidades compartidas o permisos/datos, identifica consumidores con `graphify affected "<id>" --depth 2`; usa `path/explain` si aclaran una relación. Confirma definición, usos y pruebas directamente: el grafo no garantiza cobertura, especialmente Firestore/RLS y llamadas dinámicas. Ante etiquetas duplicadas, usa IDs exactos y comprueba `source_file`/ubicación.
- Vigencia/cobertura: contrasta definición, usos y pruebas actuales; una fecha o un Git sucio no bastan para validar el mapa. Símbolos ausentes, resultados vacíos, dirección incorrecta o código que contradice el grafo obligan a búsqueda nativa dirigida. Nunca concluir «sin consumidores» o «seguro» solo por el mapa; conserva IDs exactos y verifica archivo/ubicación. No reconstruyas solo por una búsqueda vacía.
- Si esta tarea modificó código indexable, actualiza UNA vez al cierre desde la raíz: `GRAPHIFY_NO_AUTO_REFRESH=1 graphify update . --no-cluster`. Antes, conserva copia del JSON vigente en almacenamiento local privado y sus conteos; después comprueba JSON válido/no vacío y presencia o ausencia esperada de los símbolos que cambiaste. Un exit 0 no basta. No por cada edición/consulta ni por cambios solo en docs/CSS. Sin `--force`, borrado ni rollback automático: ante bloqueo/fallo, conserva el respaldo, usa fuentes y reporta pendiente. No confundas JSON actualizado con HTML/wiki actualizados, ni con tests aprobados.
- Si faltan CLI/grafo o la consulta falla, continúa con búsqueda/lectura nativa; no instales ni reconstruyas automáticamente con un modo distinto. No pasada semántica/API, hooks/watch, grafos globales, secretos ni publicación de artefactos. Respeta exclusión local de Git, reglas del proyecto y overrides explícitos del usuario.
- En cambios sustanciales, cierra con una línea de evidencia: Graphify consultado/omitido y motivo, actualizado o pendiente; no afirmes uso automático de otro agente sin verlo. Ponytail full/Caveman lite y gates existentes se mantienen.
- En Proyecto Emilio, verifica RPC/RLS/roles y presupuesto dual directamente en SQL y código; nunca ejecutar migraciones ni smoke E2E remotos por consultar o actualizar el grafo.
<!-- GRAPHIFY-WORKFLOW:END -->

- Prefers Spanish UI copy aligned with Emilio’s wording: “nuevo proyecto” (not “Nueva obra”), “Estatus” (not “Estado”), and a “cliente” field on projects.
- “Paquete” is unclear to stakeholders; keep the field with help text until Emilio clarifies; do not invent a business meaning.
- Wants material budget (presupuesto) addable during project creation, not only later.
- Catalog should group materials under Obra Civil (Registros, Tubería) and Electromecánico (Transformadores, Cableado, Accesorios subterráneos, Accesorios aéreos/herrajes, Alumbrado público).
- Material requests should behave as purchase orders that deduct from budget; treat saldo as presupuesto (cantidad + dinero).
- Request UI: searchable material dropdown, note field labeled only “Nota”, title “Solicitud para requisición de materiales”, and non-material lines (flete, camiones, mantenimiento, otro).
- Approval chain: create req → Thalía (`compras`) approves → Blanquita (`finanzas`) pays/approves; statuses `recibida`, `en_proceso`, `finalizada`.
- Reception flow: personal on site captures; Talía reviews.
- Prefers a private GitHub remote; branch names use the `cursor/` prefix; when shipping finished work, often asks to commit and push to `main`.
- Field PWA look is locked: navy `#132A45` / teal `#1E7F7A`, system fonts, no Google Fonts or Lucide; utilitarian mobile chrome (top bar + campanita, bottom nav ≤5 with overflow in “Más”), no emoji-heavy UI.
- Hide money/prices from role `personal` on project detail and related surfaces; show saldo as Usado / Comprometido / Disponible where appropriate.
- Admin UX: only `acceso_total` manages users (`/usuarios`); `acceso_total` + `operacion` view bitácora; create users with optional temporary password shown once (SMV-Hub style, adapted here).

## Learned Workspace Facts

- This app is Emilio’s materials/proyecto traceability system (Next.js + Supabase), built in ordered phases (catalog/obras → solicitudes → cotización/OC → recepción → asignación → traspasos → cierre). UI says “proyecto”; table remains `obras`.
- `obras` has `cliente`, `presupuesto_mxn`, free-text `fraccionamiento`/`paquete`, and `estado` `activa` | `pausada` | `cerrada`.
- Roles: `personal`, `compras` (Talía), `proyectos` (Manuel), `operacion` (Iveth), `finanzas` (Blanquita — pagos), `acceso_total` (Emilio).
- Dual budget: quantity via `obra_material_contratado` / `v_saldo_material_obra`; money via `obras.presupuesto_mxn` / `obra_presupuesto_movimientos` / `v_saldo_presupuesto_obra`. Compras reserves; Finanzas spends and emits OC (`0006`–`0007`).
- Schema migrations under `supabase/migrations/` need user review before apply/merge; when the user explicitly asks, the agent may apply them to remote Supabase (MCP). Financial correctness and RLS remain non-negotiable.
- Visual system is locked in `design.md` with tokens in `globals.css`; mobile shell uses TopBar, role-based AppNav, and MoreSheet. UI drafts may use Superdesign; do not import SMV-Hub tokens.
- Phases 6–7 and notifications Realtime are applied on remote Supabase (`0009` traspasos, `0010` cierre/conciliación, `0011` notificaciones); in-app bell + `/notificaciones`.
- Later migrations: `0020` reserva provisional/borrado materiales, `0021` precio cotizado compras, `0022` OC/facturas por material, `0023` inventario campo/instalaciones, `0024` usuarios admin/bitácora.
- Admin module: `/usuarios` (`acceso_total`) and `/bitacora` (`acceso_total` + `operacion`) over existing `usuarios`/`auditoria`; Auth create/reset needs server-only `SUPABASE_SERVICE_ROLE_KEY` (never in client). SMV-Hub is the UX reference, adapted to Emilio’s fixed roles.
- Producción y catálogo: a solicitud expresa de Emilio, la base de datos se reinició para comenzar proyectos desde cero con las obras y compras limpias (0 obras, 0 solicitudes, 0 OCs), conservando íntegro y protegido el catálogo de producción (20 materiales registrados, 9 kits de producción, categorías, fotos en Storage y las 5 cuentas de usuario). Existe un respaldo preventivo de las obras y transacciones anteriores en `backup_obras_molinos_presidentes.json`.
