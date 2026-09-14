# Extractable DraftComponents

## TopBar
- Source: `components/TopBar.tsx`
- Category: layout
- Description: Sticky glass header with logo OT, section title, desktop nav, search, bell
- Extractable props: activeSection (string), userName (string|null), showInventario (boolean), showRecepcion (boolean), showOrdenes (boolean), showTraspasos (boolean)
- Hardcoded: OT mark, ObraTrack label, colors navy/teal, ⌘K affordance

## AppNav
- Source: `components/AppNav.tsx`
- Category: layout
- Description: Mobile bottom tab bar ≤5 + Más sheet trigger
- Extractable props: activeItem (string), showProyectos (boolean), showRecepcion (boolean), showInventario (boolean), showOrdenes (boolean)
- Hardcoded: icon set, labels in Spanish, teal/ink active treatment

## MoreSheet
- Source: `components/MoreSheet.tsx`
- Category: layout
- Description: Overflow menu sheet for secondary destinations + logout
- Extractable props: open (boolean), visibility flags per destination
- Hardcoded: item layout, overlay

## PageHeader
- Source: `components/PageHeader.tsx`
- Category: basic
- Description: Page title block with optional back + primary action
- Extractable props: title, subtitle, backHref, actionLabel, actionHref
- Hardcoded: btn-primary classes, accent back link

## Badge
- Source: `components/Badge.tsx`
- Category: basic
- Description: Status pill with semantic variants
- Extractable props: variant, children
- Hardcoded: color maps

## EmptyState
- Source: `components/EmptyState.tsx`
- Category: basic
- Description: Dashed empty card with CTA
- Extractable props: title, description, actionLabel, actionHref
- Hardcoded: dashed border card

## ListFilters (to redesign as FilterChipsToolbar)
- Source: `components/ListFilters.tsx`
- Category: basic
- Description: Search + status + obra filters (current card form)
- Extractable props: statuses, searchLabel, selectedStatus, query
- Hardcoded: form card layout (replace with chips in redesign)
