# Routes — ObraTrack (Next.js 15 App Router)

Framework: Next.js App Router · TypeScript · Tailwind. Auth gate via session in root layout.

## Root layout
- `app/layout.tsx` — TopBar + AppNav when logged in; `globals.css`; PWA manifest.

## Key routes (lote D + related)

| URL | File | Summary |
|-----|------|---------|
| `/` | `app/page.tsx` | Panel operativo: quick actions, KPIs, projects workbench |
| `/login` | `app/login/page.tsx` | Login |
| `/solicitudes` | `app/solicitudes/page.tsx` | Requisition queue with ListFilters |
| `/solicitudes/nueva` | `app/solicitudes/nueva/page.tsx` | New request form |
| `/solicitudes/[id]` | `app/solicitudes/[id]/page.tsx` | Request detail + approvals |
| `/inventario` | `app/inventario/page.tsx` | Field inventory by obra |
| `/inventario/[obraId]` | `app/inventario/[obraId]/page.tsx` | Materials pending install |
| `/obras/[id]` | `app/obras/[id]/page.tsx` | Project detail |
| `/obras/nueva` | `app/obras/nueva/page.tsx` | New project |
| `/recepciones` | `app/recepciones/page.tsx` | Receptions list |
| `/ordenes` | `app/ordenes/page.tsx` | Purchase orders |
| `/ordenes/[id]` | `app/ordenes/[id]/page.tsx` | OC detail |
| `/materiales` | `app/materiales/page.tsx` | Catalog |
| `/traspasos` | `app/traspasos/page.tsx` | Transfers |
| `/notificaciones` | `app/notificaciones/page.tsx` | Notifications |
| `/proveedores` | `app/proveedores/page.tsx` | Vendors |

UI copy says **proyecto**; SQL table remains `obras`.
