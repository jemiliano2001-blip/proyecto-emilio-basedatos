# Design — ObraTrack (Proyecto Emilio)

Sistema visual de la app. Toda pantalla nueva o rediseño lee este archivo antes
de emitir código. No se regenera por página: se extiende o corrige aquí.

> Especificación 2026: Arquitectura UI/UX **Cálido & Orgánico (Humanist Wellness)**
> Arquetipo de Marca: **El Cuidador (The Caregiver)** — accesibilidad universal (WCAG AAA),
> ergonomía visual que reduce la ansiedad digital mediante tonos tierra, calidez y
> alta densidad operativa. Se adoptó la paleta **60-30-10** (#F8FAFC / #FFFFFF / #0369A1 / #0F766E),
> titulares en **Playfair Display**, cuerpo en **Poppins** y radio consistente de **16px**.

## Género

modern-organic · tono: SaaS operativo / financiero humano y sereno. Una acción primaria por
pantalla (#0369A1). Densidad media en oficina, táctil (≥44px) en campo.

## Tokens (fuente de verdad: `app/globals.css` + `tailwind.config.ts`)

Todos los colores son variables HSL en `:root` y se consumen vía Tailwind con
soporte de opacidad (`bg-primary/10`). **No usar colores crudos de Tailwind**
(`text-gray-500`, `bg-red-50`, …) en `app/` ni `components/`.

| Rol | Token | Light |
|-----|-------|-------|
| 60% Fondo de página | `background` | #F8FAFC (`210 40% 98%`) |
| 30% Superficie / tarjeta | `card` | #FFFFFF con sombra `elevated` |
| Texto principal | `foreground` | #0F172A (`222.2 47.4% 11.2%`) |
| Texto secundario | `muted-foreground` | #64748B (`215.4 16.3% 46.9%`) |
| Relleno suave | `muted` | #F1F5F9 (`210 40% 96.1%`) |
| Borde | `border` / `input` | #E2E8F0 (`214.3 31.8% 91.4%`) |
| 10% Acción primaria (CTA) | `primary` · `primary-hover` · `primary-foreground` | #0369A1 / #075985 / #FFFFFF |
| Tinte primario suave | `primary-soft` · `primary-soft-foreground` | #F0F9FF / #0369A1 |
| Soporte secundario | `secondary` · `secondary-soft` | #0F766E / #F0FDFA |
| Estatus | `success` (#10B981) · `warning` (#F59E0B) · `danger` (#EF4444) · `info` (#0369A1) | |
| Sidebar | `sidebar`, `sidebar-foreground`, `sidebar-muted`, `sidebar-border`, `sidebar-accent(-foreground)` | |

Patrón de estatus: **sólido** (`bg-danger text-danger-foreground`) para
controles; **suave** (`bg-danger-soft text-danger-soft-foreground
border-danger/25`) para badges, alertas y filas.

## Tipografía

- **Titulares (H1 / H2):** **Playfair Display** (`--font-heading`), pesos 600/700/800.
- **Cuerpo y Datos:** **Poppins** (`--font-sans`), pesos 400/500/600/700.
- Regla de los 3 niveles: H1 (28-32px), H2 (18-22px), Body (16px base, interlineado 1.5 a 1.6).
- Longitud de línea: Máximo 70 a 80 caracteres (`max-w-[75ch]`) para evitar fatiga visual.
- Dinero y cantidades: `tabular-nums`.

### Escala tipográfica (utilidades en `globals.css`)

| Clase | Uso | Tamaño |
|-------|-----|--------|
| `.t-display` | Login, pantallas de bienvenida | 30 / 36px · Playfair 700 |
| `.t-h1` | Título de página (`PageHeader`) | 24 / 30px · Playfair 700 |
| `.t-h2` | Título de sección | 18 / 20px · Playfair 700 |
| `.t-body` | Texto de lectura | 14 / 16px · Poppins 400 |
| `.t-caption` | Ayudas, metadatos | 12px · muted |
| `.t-eyebrow` | Contexto sobre el título (con filete de marca) | 11px · caps · tracking 0.14em |

Usa estas clases en lugar de recomponer `text-* font-heading` a mano.

## Espaciado y radio

- Border Radius: **16px** consistente en botones, tarjetas, inputs y modales (`rounded-2xl` / `--radius: 1rem`).
- Modificadores de densidad para oficina: `btn-sm` (40px, rounded-xl 12px) y `btn-xs` (32px, rounded-lg 10px).
- Sombras: `elevated` suaves y acogedoras, evitando aristas duras o contrastes negros agresivos.
- Escala de elevación: `xs` (controles) → `card` (superficies en reposo) →
  `card-hover` (interactivas) → `elevated` (diálogos) → `popover` (menús).
  CTA primario: `shadow-primary` / `shadow-primary-hover` (brillo interior +
  sombra tintada con el color de marca).
- Espaciado: múltiplos de 4px (`gap-2/3/4/6`, `p-5` tarjetas, `py-8` secciones).

## Identidad

- **Plano de obra:** retícula fina `.bg-blueprint` (enmascarada en radial) en
  paneles de marca y estados vacíos. Es la firma visual; no usarla como fondo
  de contenido.
- Fondo de página con dos halos de marca muy sutiles (`body` en `globals.css`).
- Eyebrow con filete (`.t-eyebrow`) sobre los títulos de página.

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
- Estados de todo control interactivo: hover (color + elevación), `focus-visible`
  (anillo `ring`, nunca animado), active (`scale-[0.98]`), disabled (50 %, sin
  eventos) y loading.
- **Loading:** `aria-busy="true"` en cualquier `.btn-*` muestra spinner por CSS y
  bloquea clics; `ui/button` con `loading` hace lo mismo. Listas y tarjetas
  usan `.skeleton` / `ui/skeleton` (shimmer con las mismas medidas que el
  contenido, CLS = 0).
- `select.input-base` lleva chevron propio (`appearance-none`).
- `KpiMetricCard`: el sparkline solo se dibuja si se pasan `sparklineData`
  reales. Nunca inventar tendencias.

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
