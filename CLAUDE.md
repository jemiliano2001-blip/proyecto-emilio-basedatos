# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Escrito en español porque `.cursorrules`, `README.md` y `AGENTS.md` (los docs
> autoritativos de este repo) están en español. El `CLAUDE.md` de la carpeta padre
> (`IA Personal/`) es la memoria personal de Emiliano y se hereda automáticamente —
> no lo repitas ni lo edites desde aquí.

## Qué es esto

Sistema de trazabilidad de materiales, presupuestos y compras para una empresa de
construcción/instalación eléctrica. Next.js 14 (App Router) + TypeScript estricto +
Tailwind + Supabase (PostgreSQL), como PWA offline-first.

**Los errores aquí cuestan dinero real.** La correctitud de los datos financieros y la
integridad van antes que la velocidad de entrega. Trátalo como una app bancaria chica.

**En la UI se dice "proyecto"; la tabla se sigue llamando `obras`.** Esta discrepancia
recorre todo el código: `obra_id`, `v_saldo_material_obra`, `/obras/[id]`. No la
"arregles" renombrando.

## Comandos

```bash
npm run dev        # servidor de desarrollo en :3000 → entra por /login
npm run build
npx tsc --noEmit   # typecheck — pasa limpio hoy; es LA puerta de verificación real
```

⚠️ **`npm run lint` no sirve tal cual**: no existe config de ESLint en el repo, así que
`next lint` abre el asistente interactivo de configuración y no lint-ea nada. No lo uses
como verificación hasta que se configure.

**No hay framework de pruebas instalado** (ni Jest, ni Vitest, ni Playwright) y no se
introduce uno sin pedirlo. No existe un comando para "correr un test suelto". La
verificación es:

1. `npx tsc --noEmit`
2. los smoke E2E en PowerShell: `scripts/e2e-fase3.ps1`, `e2e-fase4.ps1`, `e2e-fase5.ps1`,
   `e2e-fase6.ps1` (traspasos), `e2e-fase7.ps1` (cierre/conciliación)
   (correr uno solo es el equivalente más cercano a "un test")

⚠️ **Los scripts E2E pegan al Supabase remoto real y mutan datos.** Leen `.env.local`,
se autentican con los usuarios sembrados y escriben en producción-de-desarrollo. En
particular `e2e-fase5.ps1` exige que existan ≥2 obras activas, hace upsert de
`obra_material_contratado.cantidad_contratada = 100000` y un PATCH de
`obras.presupuesto_mxn = 1000000` sobre dos obras. No lo corras a ciegas sobre datos
que le importen a alguien.

Usuarios de prueba y sus contraseñas: `README.md` y `supabase/seed_usuarios_prueba.sql`.

## Migraciones

SQL numerado en `supabase/migrations/` (`0001` … `0008`). **No hay Supabase CLI ni
`supabase/config.toml` en el repo** — las migraciones las aplica el usuario a mano
(dashboard / MCP de Supabase). No inventes un `supabase db push`.

**Regla dura:** el agente nunca aplica ni mergea una migración sin que Emiliano/Emilio
la revisen primero (`.cursorrules`, y reafirmado en el plan de Fase 5). Escribe el `.sql`,
explícalo, y detente ahí.

## Arquitectura

### Dos capas de autorización — solo una es seguridad

- `lib/roles.ts` (`puedeAprobarCompras`, `puedeCrearSolicitudMultiObra`, …) son
  predicados de **conveniencia de UI**: deciden qué botón se pinta y cortan temprano en
  los server actions. **Nunca son la frontera de seguridad.**
- La seguridad real vive en la base: políticas RLS + funciones `security definer` que
  validan `auth_rol()` contra la tabla `usuarios.rol`.
- `lib/supabase/server.ts` usa **anon key + cookie de sesión del usuario**, precisamente
  para que RLS aplique. La `service_role` key nunca se importa ahí.
- Si agregas un permiso, agrégalo en **ambas** capas o no lo agregaste.

### Todo cambio de estado y toda aritmética de presupuesto va por RPC

Nunca por `update` directo desde el cliente:

| RPC | Qué hace |
|-----|----------|
| `aprobar_solicitud_compras` | Compras reserva saldo (cantidad + dinero) |
| `aprobar_pago_solicitud` | Finanzas paga y emite OC — **devuelve `uuid[]`** (una OC por obra) |
| `rechazar_solicitud` / `cancelar_solicitud` | liberan lo reservado |
| `crear_recepcion`, `revisar_recepcion`, `listar_*`, `detalle_*` | flujo de recepción (Fase 4); las vistas de recepción son internas, el cliente solo ve estas RPCs |
| `crear_solicitud_traspaso`, `aprobar_traspaso`, `confirmar_recepcion_traspaso`, `rechazar_traspaso`, `cancelar_traspaso` | traspasos entre obras (Fase 6, sin aplicar) |
| `cerrar_obra`, `reabrir_obra` | cierre de proyecto (Fase 7, sin aplicar) |

**Y las RPCs no son suficientes por sí solas.** PostgREST expone UPDATE directo sobre las
tablas a los mismos roles, así que cada máquina de estados necesita además un trigger
`before update` que la haga cumplir pase por donde pase el cambio:
`fn_solicitudes_material_before_update` (0007) y `fn_traspasos_obra_before_update` (0009).
Si agregas una tabla con estados que afecten saldos, replica ese patrón — una policy que
solo dice *quién* puede escribir no dice *qué* transiciones son válidas.

### Presupuesto dual

- **Cantidad:** `obra_material_contratado` → vista `v_saldo_material_obra`
  (contratado / usado / comprometido / disponible), `numeric(12,2)`.
- **Dinero:** `obras.presupuesto_mxn` → `obra_presupuesto_movimientos` → vista
  `v_saldo_presupuesto_obra`.
- Compras **compromete**; Finanzas **gasta** y emite la orden de compra.

### Máquina de estados de la requisición

`recibida` → `en_proceso` → `finalizada`, más `rechazada` / `cancelada`.
Los estados legacy `pendiente` / `en_cotizacion` / `aprobada` **siguen existiendo en
datos viejos** y por eso los `switch` de la UI los siguen contemplando — no los borres.

### Multi-obra (Fase 5)

`solicitud_items.obra_id` es nullable: cuando es `null` hereda la obra de la cabecera
(el flujo normal de Personal, ~95% del uso). Una requisición de Compras puede repartir
renglones entre varias obras. La aprobación es **todo-o-nada**: si falta saldo en
cualquier obra involucrada, no se reserva nada. Al pagar se emite **una OC por cada obra
distinta**.

### Ida y vuelta offline

```
IndexedDB (lib/offline/db.ts)
  → lib/offline/sync.ts
  → POST /api/{solicitudes,recepciones}/sync
  → el MISMO server action (syncSolicitudPayload / equivalente de recepciones)
```

Idempotente sobre un UUID generado en el cliente. Protocolo de 4 estados mapeado a HTTP:
`sincronizado`→200, `no_autenticado`→401, `conflicto`→409, `reintentar`→503.

**Consecuencia práctica:** las reglas de validación viven en `lib/validations/*` porque
el formulario y la ruta de sync comparten el mismo validador. Si parchas solo el
formulario, rompes la ruta offline en silencio.

### Cotización (Fase 3) es legacy pero sigue viva

El camino feliz nuevo es req → Compras → Finanzas → OC, **sin cotizar**. Las pantallas
de cotización siguen ahí para el flujo anterior. `puedeCotizar()` está marcado
`@deprecated` por eso.

### Fallbacks defensivos

`lib/actions/solicitudes.ts` trae reintentos para el caso de "migración aún no aplicada"
(el retry cuando el error incluye `'recibida'`, el UPDATE directo en
`cancelSolicitudAction`). Reconoce el patrón, pero **no agregues más** — son deuda de
una época en que el remoto iba detrás del repo.

## Seguridad — no negociable (de `.cursorrules`)

1. **RLS activado en toda tabla nueva, en el mismo commit en que se crea.** Nunca "lo
   agrego después".
2. Las políticas validan contra `usuarios.rol` / `auth_rol()` — **nunca** contra claims
   del JWT que el cliente pueda manipular.
3. La `service_role` key nunca va en `app/` ni `components/`. Si la ves ahí, es un bug de
   seguridad: detente y avisa.
4. Tablas financieras y de auditoría llevan trigger de auditoría (quién, qué, cuándo,
   valor anterior). No confíes en que el frontend lo registre.
5. **No agregues dependencias nuevas sin preguntar.** No uses Firebase ni ningún NoSQL.
6. No generes datos de ejemplo con precios o nombres de materiales reales inventados —
   usa placeholders tipo "Material de ejemplo".

`.cursorrules` es la autoridad completa; léelo antes de tocar una tabla nueva.

## Convenciones

- Tablas y columnas: **español, snake_case** (`solicitudes_material`, `cantidad_asignada`).
- Roles exactos en `usuarios.rol`: `personal`, `compras` (Talía), `proyectos` (Manuel),
  `operacion` (Iveth), `finanzas` (Blanquita — pagos), `acceso_total` (Emilio).
- Componentes React en PascalCase (`components/`), rutas en minúsculas (App Router).
- Server actions en `lib/actions/`, validadores en `lib/validations/`, alias `@/*` → raíz.
- UI mobile-first, minimalista, botones grandes, texto claro en vez de solo iconos —
  la usa personal en obra, con el celular.
- Toda pantalla que use Personal (solicitudes, checklist de recepción) **debe funcionar
  sin conexión** y sincronizar después.
- Ramas de trabajo con prefijo `cursor/`. Copy de UI en español, siguiendo el vocabulario
  de Emilio (ver `AGENTS.md`).

## Orden de fases — no te saltes ninguna

Aplicadas en remoto: 1 catálogo/obras · 2 solicitudes · 3 cotización/OC · 4 recepción ·
5 asignación y multi-obra (migraciones `0001`–`0008`).

**6 traspasos entre obras** y **7 cierre + conciliación** ya están escritas
(`0009`, `0010` + su UI) pero **NO aplicadas en el Supabase remoto**. Hasta que se
apliquen, `/traspasos` y `/obras/[id]/conciliacion` truenan al cargar.

En un traspaso **el dinero sigue al material**: el precio se congela al aprobar
(`traspaso_items.precio_unitario_mxn`, del último precio de compra) y al completarse se
abona a la obra origen y se carga a la destino. Ese neto **no** vive en
`obra_presupuesto_movimientos` — se calcula dentro de `v_saldo_presupuesto_obra`, porque
esa tabla exige `monto_mxn > 0` y no tiene un tipo para devolver dinero gastado. Si
buscas por qué no cuadra un presupuesto, mira los traspasos completados de la obra.

`README.md` es el documento vivo de estado; los diseños y planes de cada fase viven en
`docs/superpowers/`.
