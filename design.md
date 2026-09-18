# Design — ObraTrack (Proyecto Emilio)

Sistema visual de la app. Toda pantalla nueva o rediseño lee este archivo antes
de emitir código. No se regenera por página: se extiende o corrige aquí.

> Cambio de rumbo (sep-2026): el producto se posiciona como **SaaS** de
> trazabilidad de materiales. Se reemplazó la paleta navy/teal de campo por
> "Slate + Cobalto", se adoptó **Inter** (self-hosted) y el shell de escritorio
> pasó de barra superior a **sidebar colapsable**. La bottom nav móvil se
> conserva porque Personal la usa en obra.

## Género

modern-minimal · tono: SaaS operativo / financiero. Una acción primaria por
pantalla. Densidad media en oficina, táctil (≥44px) en campo.

## Tokens (fuente de verdad: `app/globals.css` + `tailwind.config.ts`)

Todos los colores son variables HSL en `:root` y se consumen vía Tailwind con
soporte de opacidad (`bg-primary/10`). **No usar colores crudos de Tailwind**
(`text-gray-500`, `bg-red-50`, …) en `app/` ni `components/`.

| Rol | Token | Light |
|-----|-------|-------|
| Fondo de página | `background` | slate-50 |
| Superficie / tarjeta | `card` | white |
| Texto | `foreground` | slate-900 |
| Texto secundario | `muted-foreground` | slate-500 (4.8:1) |
| Relleno suave | `muted` | slate-100 |
| Borde | `border` / `input` | slate-200 / slate-300 |
| Acción primaria | `primary` · `primary-hover` · `primary-foreground` | blue-600 / blue-700 / white |
| Tinte primario | `primary-soft` · `primary-soft-foreground` | blue-50 / blue-700 |
| Estatus | `success` · `warning` · `danger` · `info` (+ `-soft`, `-soft-foreground`) | emerald / amber / red / sky |
| Sidebar | `sidebar`, `sidebar-foreground`, `sidebar-muted`, `sidebar-border`, `sidebar-accent(-foreground)` | |

Patrón de estatus: **sólido** (`bg-danger text-danger-foreground`) para
controles; **suave** (`bg-danger-soft text-danger-soft-foreground
border-danger/25`) para badges, alertas y filas. Nunca texto de estatus sobre
tinte de otro tono.

Alias legacy (`ink`, `navy`, `teal`, `accent`, `paper`, `warn`) siguen
compilando pero **no se usan en código nuevo**.

### Dark mode

Preparado en `:root[data-theme='dark']`, sin exponer en la UI. Activar = poner
`data-theme="dark"` en `<html>` y revisar contraste por pantalla. No agregar
overrides `dark:` en componentes: todo debe resolverse por tokens.

## Tipografía

- **Inter** vía `next/font/google` (`--font-sans`), self-hosted en build:
  cero requests a Google, cacheada por el service worker como asset estático.
- Pesos: 400 cuerpo · 500 etiquetas/nav · 600 títulos y botones. Sin 700+.
- Tamaños: 12 (meta) · 14 (UI densa) · 16 (cuerpo/inputs móvil) · 20/24 (h1).
- Dinero y cantidades: `tabular-nums`.

## Espaciado y radio

4-pt scale. `--radius: 0.5rem` (controles), `rounded-xl` (tarjetas).
Botones y nav: ≥44px en móvil; en oficina `btn-sm` (40px) y `btn-xs` (32px).

## Shell

- **≥ lg (1024px):** `AppSidebar` fijo a la izquierda (16rem, contraído 4.25rem),
  secciones Operación / Compras y catálogo / Administración, buscador ⌘K,
  usuario + cerrar sesión al pie. Estado persistido en cookie `ot-sidebar`
  y reflejado en `<html data-sidebar>` para evitar flash. Atajo Ctrl/⌘+B.
- **< lg:** `TopBar` (marca + título + ⌘K + campanita) y `AppNav` bottom nav
  ≤ 4 pestañas + "Más" (`MoreSheet`).
- La navegación vive en **un solo lugar:** `lib/nav.ts` (`NAV_ITEMS`,
  visibilidad por rol, pestañas móviles, migas). Sidebar, bottom nav, hoja
  "Más" y TopBar la consumen; no dupliques predicados de rol en componentes.
- Elementos flotantes (toasts, barras de lote) se centran sobre el contenido
  con `left-[calc(50%+var(--sidebar-current)/2)]` y suben sobre la bottom nav
  con `var(--nav-height)`.

## Layout de página

- `.page-shell` (max-w-5xl) listas y detalle · `.page-shell-wide` (max-w-7xl)
  dashboard y workbenches · `.page-shell-narrow` (max-w-3xl) formularios.
- `PageHeader`: `eyebrow` (contexto), título, `badge`, `description`,
  `actions` a la derecha (una `btn-primary`, el resto `btn-secondary`),
  `backHref` como enlace discreto. Acepta `children` para tabs/KPIs.
- Detalles de oficina en `lg+`: dos columnas (`minmax(0,1fr)_20rem`) con rail
  derecho sticky para resumen/presupuesto/acciones de ciclo de vida.
- Listas: `.list-stack` + `.list-row` (+ `.list-header` en `lg`). KPIs:
  `.stat-tile` / `.stat-label` / `.stat-value` (tarjetas blancas, no tiles
  oscuros).

## Componentes

- Botones: `.btn-primary` · `.btn-secondary` · `.btn-ghost` · `.btn-danger`
  con modificadores `.btn-sm` / `.btn-xs`. Variante React en `components/ui/button`.
- Badges: `components/Badge` variantes `success | warning | danger | info | neutral`
  (legacy `teal/amber/red/navy/gray` mapean). `dot` para listas densas.
- Inputs: `.input-base` (o `ui/input`, `ui/textarea`); labels visibles con
  `.field-label`; ayuda `.field-hint`; error `.field-error`; inválido con
  `aria-invalid`.
- Filtros: `ListFilters` (toolbar en tarjeta, chips de estatus, "Aplicar
  filtros"/"Limpiar"); segmentos `FilterTabs` / `ui/tabs` en blanco sobre gris.
- Estados vacíos: `EmptyState` (borde punteado, icono en caja, una acción).
- Iconos: SVG inline de un trazo en `components/icons.tsx`. **Nunca emojis ni
  glifos Unicode como iconos.**

## Movimiento

`--ease-out: cubic-bezier(0.16,1,0.3,1)`, 150–220ms, solo `opacity`/`transform`
(y `width`/`padding` del sidebar a 200ms). `prefers-reduced-motion` respetado
globalmente. Focus ring nunca se anima.

## Microinteracciones

- Éxito silencioso (el dato en pantalla basta). Toast oscuro solo para
  acciones reversibles con **Deshacer** (5 s).
- Loading en el botón que disparó la acción (`aria-busy`).
- Confirmación solo en destructivos.
- Formularios largos guardan borrador local por usuario.

## Copy

Español, vocabulario de Emilio (**proyecto**, **estatus**, **requisición**).
Sentence case en botones y títulos. Verbo claro: "Solicitar material",
"Aprobar pago", "Cerrar proyecto".

## Qué NO hacer

- Colores crudos de Tailwind o hex en componentes.
- Más de una `btn-primary` visible por pantalla.
- Texto con `opacity` para atenuar: usar `text-muted-foreground`.
- Importar constantes desde archivos `'use client'` hacia server components
  (llegan como referencias de cliente, no como valores). Van en `lib/`.
- Registrar el service worker en desarrollo (cachea chunks y rompe HMR).
