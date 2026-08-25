# Design — Proyecto Emilio

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

## Genre

modern-minimal · tone: utilitarian

App de trazabilidad de materiales para personal de campo (celular, a veces en
obra) y oficina (Compras, Finanzas, Proyectos). Una acción primaria por
pantalla. No es landing ni marketing.

## Macrostructure family

- Marketing pages: no hay.
- App pages: list-detail / workbench. Lista de cards → detalle → acción.
- Content pages: no hay.

## Theme

Valores anclados a la marca existente. No rotar catálogo Hallmark.

- `--color-paper`   `#F9FAFB` (gray-50)
- `--color-paper-2` `#FFFFFF`
- `--color-ink`     `#132A45` (navy — títulos, CTA, tab activo)
- `--color-ink-2`   `#4B5563` (gray-600 — secundario)
- `--color-rule`    `#E5E7EB` (gray-200)
- `--color-accent`  `#1E7F7A` (teal — links, saldo disponible, focus)
- `--color-focus`   `#1E7F7A`
- `--color-danger`  `#DC2626`
- `--color-warn`    `#D97706`

Light mode only. Campo al sol; no dark mode en este lote.

## Typography

- Display / body / mono: system UI stack (`ui-sans-serif`, `system-ui`,
  `Segoe UI`). PWA offline-first — sin Google Fonts ni `next/font`.
- Headings: weight 700, `font-style: normal` (nunca italic).
- Body: 16px mínimo en inputs (evita zoom iOS).
- Números de dinero y cantidades: `font-variant-numeric: tabular-nums`.

## Spacing

4-point scale. Botones y nav: mínimo 44×44px, hueco ≥ 8px.

## Motion

- Easings: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`
- Duración corta: 150–220ms. Solo `opacity` y `transform`.
- Reduced-motion: opacity-only, ≤ 150ms. Focus ring nunca se anima.

## Microinteractions stance

- Silent success (el dato nuevo en pantalla basta). Sin toasts celebratorios.
- Loading en el botón que disparó la acción (`aria-busy`).
- Confirmación solo en destructivos (cerrar proyecto).

## CTA voice

- Primary: fill navy, `rounded-lg`, `px-5 py-3`, texto 16px semibold.
- Secondary: outline navy/rule, mismo tamaño táctil.
- Destructive: fill danger, separado espacialmente del primary.
- Un primary por pantalla. Copy en español, verbo claro (“Solicitar material”,
  “Cerrar proyecto”). Cero emojis como iconos.

## Chrome

- Top bar sticky: título de sección + campanita (badge). No es un tab.
- Bottom nav ≤ 5: icono SVG + etiqueta. Logout vive en la hoja **Más**.
- Safe area iOS en top bar y bottom nav.
- Copy visible: **proyecto**. El SQL se queda `obras`.

## What pages MUST share

- Navy + teal, system fonts, CTA voice, cards blancas con borde rule.
- Iconos SVG inline (`components/icons.tsx`), un trazo.
- Clases `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.card`, `.input-base`.

## What pages MAY differ on

- Acciones primarias según rol.
- Densidad de datos (conciliación puede ser `max-w-4xl`).

## Exports

Implementado en `app/globals.css` (`:root`) y `tailwind.config.ts`
(`ink`, `accent`, `paper`, `danger`, `warn`). No hay `tokens.css` aparte para
no duplicar la fuente de verdad.
