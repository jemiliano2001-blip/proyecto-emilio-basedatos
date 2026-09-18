## Learned User Preferences

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
- Producción y depuración: la base de datos de Supabase y Storage se limpiaron de datos de prueba (obras de ejemplo A/B, Fase 7, Grok bot, Etapa 3 y materiales de ejemplo eliminados). Permanecen activas exclusivamente las obras reales de Emilio (`Molinos del Rey` y `Los Presidentes`), con sus partidas contratadas, solicitudes y OCs reales, así como el catálogo de 20 materiales y 9 kits de producción.
