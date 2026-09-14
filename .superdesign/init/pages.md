# Page dependency trees (lote D)

## `/` Home — Panel Operativo
Entry: `app/page.tsx`
Dependencies:
- `components/PageHeader.tsx`
  - `components/icons.tsx`
  - `lib/utils.ts`
- `components/HomeProjectsWorkbench.tsx`
  - `components/Badge.tsx` → `components/ui/badge.tsx`
  - `components/EmptyState.tsx`
  - `components/icons.tsx`
- `components/icons.tsx`
- Shell (via layout): `components/TopBar.tsx`, `components/AppNav.tsx`
- Tokens: `app/globals.css`, `design.md`, `tailwind.config.ts`

## `/solicitudes` Lista
Entry: `app/solicitudes/page.tsx`
Dependencies:
- `components/PageHeader.tsx`
- `components/ListFilters.tsx`
- `components/Badge.tsx`
- `components/EmptyState.tsx`
- `components/OfflineQueueBanner.tsx`
- `components/icons.tsx`
- Shell: TopBar, AppNav

## `/solicitudes/[id]` Detalle
Entry: `app/solicitudes/[id]/page.tsx`
Dependencies:
- `components/PageHeader.tsx`, `Badge`, approval components (`AprobarRequisicion`, etc.)
- Shell: TopBar, AppNav

## `/inventario` Lista obras
Entry: `app/inventario/page.tsx`
Dependencies:
- `components/PageHeader.tsx`
- `components/EmptyState.tsx`
- `components/icons.tsx`
- Shell: TopBar, AppNav

## `/inventario/[obraId]` Detalle
Entry: `app/inventario/[obraId]/page.tsx`
Dependencies:
- `components/PageHeader.tsx`
- `components/ReportarInstalacionForm.tsx` (if present)
- `components/EmptyState.tsx`
- Shell: TopBar, AppNav
